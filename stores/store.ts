import { create } from "zustand";
import type * as Monaco from "monaco-editor";
import { Document, UserSettings, DEFAULT_SETTINGS, DEFAULT_DOCUMENT_BODY } from "@/lib/types";
import { DEFAULT_DOCUMENT_TITLE } from "@/lib/document";

interface AppState {
  // Documents
  documents: Document[];
  currentDocument: Document | null;
  editorInstance: Monaco.editor.IStandaloneCodeEditor | null;

  // Settings
  settings: UserSettings;

  // UI State
  sidebarOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  previewVisible: boolean;
  zenMode: boolean;
  isDirty: boolean;
  editorScrollPercent: number;
  editorTopLine: number;

  // Document Actions
  createDocument: () => void;
  createImportedDocument: (title: string, body: string) => void;
  openLocalFile: (path: string, name: string, body: string) => void;
  markLocalFileSaved: (id: string, savedBody: string) => void;
  linkLocalFile: (id: string, path: string, name: string, savedBody: string) => void;
  selectDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  updateDocumentBody: (body: string) => void;
  updateDocumentTitle: (title: string) => void;
  setEditorInstance: (editor: Monaco.editor.IStandaloneCodeEditor | null) => void;
  insertMarkdownAtCursor: (markdown: string) => void;

  // Settings Actions
  updateSettings: (settings: Partial<UserSettings>) => void;

  // UI Actions
  toggleSidebar: () => void;
  toggleSettings: () => void;
  toggleShortcuts: () => void;
  togglePreview: () => void;
  setZenMode: (enabled: boolean) => void;
  setEditorScrollPercent: (percent: number) => void;
  setEditorTopLine: (line: number) => void;

  // Persistence
  hydrate: () => void;
  persist: () => void;
}

// Timestamp ids, bumped when several documents are created in the same millisecond
// (for example, opening several files from Finder at once).
let lastDocumentId = 0;
const nextDocumentId = (): string => {
  lastDocumentId = Math.max(Date.now(), lastDocumentId + 1);
  return lastDocumentId.toString();
};

const createDefaultDocument = (): Document => ({
  id: nextDocumentId(),
  title: DEFAULT_DOCUMENT_TITLE,
  body: DEFAULT_DOCUMENT_BODY,
  createdAt: new Date().toISOString(),
});

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  documents: [],
  currentDocument: null,
  editorInstance: null,
  settings: DEFAULT_SETTINGS,
  sidebarOpen: false,
  settingsOpen: false,
  shortcutsOpen: false,
  previewVisible: true,
  zenMode: false,
  isDirty: false,
  editorScrollPercent: 0,
  editorTopLine: 1,

  // Document Actions
  createDocument: () => {
    const newDoc = createDefaultDocument();
    set((state) => ({
      documents: [...state.documents, newDoc],
      currentDocument: newDoc,
    }));
    get().persist();
  },

  createImportedDocument: (title: string, body: string) => {
    const newDoc = {
      ...createDefaultDocument(),
      title,
      body,
    };

    set((state) => ({
      documents: [...state.documents, newDoc],
      currentDocument: newDoc,
    }));
    get().persist();
  },

  openLocalFile: (path: string, name: string, body: string) => {
    const existing = get().documents.find((d) => d.localFile?.path === path);

    // Reopening a file keeps edits that have not been saved yet; otherwise show what is on disk.
    let doc: Document;
    if (existing?.localFile?.unsaved) {
      doc = existing;
    } else if (existing) {
      doc = { ...existing, body, localFile: { path } };
    } else {
      doc = { ...createDefaultDocument(), title: name, body, localFile: { path } };
    }

    set((state) => ({
      documents: existing
        ? state.documents.map((d) => (d.id === doc.id ? doc : d))
        : [...state.documents, doc],
      currentDocument: doc,
    }));
    get().persist();
  },

  markLocalFileSaved: (id: string, savedBody: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc?.localFile) return;

    // Typing may have continued while the save was in flight.
    const updated = {
      ...doc,
      localFile: { path: doc.localFile.path, unsaved: doc.body !== savedBody },
    };

    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? updated : d)),
      currentDocument: state.currentDocument?.id === id ? updated : state.currentDocument,
    }));
    get().persist();
  },

  linkLocalFile: (id: string, path: string, name: string, savedBody: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) return;

    const updated: Document = {
      ...doc,
      title: name,
      localFile: { path, unsaved: doc.body !== savedBody },
    };

    // If another document was linked to the file just overwritten, it no longer matches it.
    const relink = (d: Document): Document => {
      if (d.id === id) return updated;
      if (d.localFile?.path !== path) return d;
      const { localFile: _unlinked, ...rest } = d;
      return rest;
    };

    set((state) => ({
      documents: state.documents.map(relink),
      currentDocument: state.currentDocument ? relink(state.currentDocument) : null,
    }));
    get().persist();
  },

  selectDocument: (id: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (doc) {
      set({ currentDocument: doc });
      get().persist();
    }
  },

  deleteDocument: (id: string) => {
    const { documents, currentDocument } = get();
    const filtered = documents.filter((d) => d.id !== id);

    let newCurrent = currentDocument;
    if (currentDocument?.id === id) {
      newCurrent = filtered[0] || null;
    }

    set({ documents: filtered, currentDocument: newCurrent });
    get().persist();
  },

  updateDocumentBody: (body: string) => {
    const { currentDocument, documents } = get();
    if (!currentDocument) return;

    const updated = { ...currentDocument, body };
    if (currentDocument.localFile && body !== currentDocument.body) {
      updated.localFile = { ...currentDocument.localFile, unsaved: true };
    }
    const updatedDocs = documents.map((d) =>
      d.id === currentDocument.id ? updated : d
    );

    set({ currentDocument: updated, documents: updatedDocs, isDirty: true });
  },

  updateDocumentTitle: (title: string) => {
    const { currentDocument, documents } = get();
    if (!currentDocument) return;

    const updated = { ...currentDocument, title };
    const updatedDocs = documents.map((d) =>
      d.id === currentDocument.id ? updated : d
    );

    set({ currentDocument: updated, documents: updatedDocs });
    get().persist();
  },

  setEditorInstance: (editor) => set({ editorInstance: editor }),

  insertMarkdownAtCursor: (markdown: string) => {
    const { editorInstance, currentDocument, documents } = get();

    if (editorInstance) {
      const selection = editorInstance.getSelection();
      if (selection) {
        editorInstance.executeEdits("dillinger-inline-insert", [
          {
            range: selection,
            text: markdown,
            forceMoveMarkers: true,
          },
        ]);
        editorInstance.focus();
        return;
      }
    }

    if (!currentDocument) return;

    const updated = { ...currentDocument, body: `${currentDocument.body}${markdown}` };
    const updatedDocs = documents.map((doc) =>
      doc.id === currentDocument.id ? updated : doc
    );

    set({ currentDocument: updated, documents: updatedDocs });
    get().persist();
  },

  // Settings Actions
  updateSettings: (newSettings: Partial<UserSettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    get().persist();
  },

  // UI Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  toggleShortcuts: () => set((state) => ({ shortcutsOpen: !state.shortcutsOpen })),
  togglePreview: () => set((state) => ({ previewVisible: !state.previewVisible })),
  setZenMode: (enabled) => set({ zenMode: enabled }),
  setEditorScrollPercent: (percent) => set({ editorScrollPercent: percent }),
  setEditorTopLine: (line) => set({ editorTopLine: line }),

  // Persistence
  hydrate: () => {
    if (typeof window === "undefined") return;

    try {
      const filesJson = localStorage.getItem("files");
      const currentJson = localStorage.getItem("currentDocument");
      const settingsJson = localStorage.getItem("profileV3");

      const isFirstVisit = !filesJson;
      let documents: Document[] = filesJson ? JSON.parse(filesJson) : [];
      let currentDocument: Document | null = currentJson ? JSON.parse(currentJson) : null;
      const settings: UserSettings = settingsJson
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) }
        : DEFAULT_SETTINGS;

      // Ensure at least one document exists
      if (documents.length === 0) {
        const defaultDoc = createDefaultDocument();
        documents = [defaultDoc];
        currentDocument = defaultDoc;
      }

      // Ensure currentDocument is valid
      if (!currentDocument || !documents.find((d) => d.id === currentDocument!.id)) {
        currentDocument = documents[0];
      }

      set({ documents, currentDocument, settings, isDirty: false, sidebarOpen: isFirstVisit });
    } catch (e) {
      console.error("Failed to hydrate state:", e);
    }
  },

  persist: () => {
    if (typeof window === "undefined") return;

    const { documents, currentDocument, settings } = get();

    try {
      localStorage.setItem("files", JSON.stringify(documents));
      localStorage.setItem("currentDocument", JSON.stringify(currentDocument));
      localStorage.setItem("profileV3", JSON.stringify(settings));
      set({ isDirty: false });
    } catch (e) {
      console.error("Failed to persist state:", e);
    }
  },
}));
