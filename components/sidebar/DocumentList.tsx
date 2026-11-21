"use client";

import { useCallback, useState } from "react";
import { FileText, X } from "lucide-react";
import { useStore } from "@/stores/store";
import { cn } from "@/lib/utils";
import { hasUnsavedChanges } from "@/lib/document";
import { useSaveDocument } from "@/hooks/useSaveDocument";
import { UnsavedChangesModal } from "@/components/modals/UnsavedChangesModal";

export function DocumentList() {
  const documents = useStore((state) => state.documents);
  const currentDocument = useStore((state) => state.currentDocument);
  const selectDocument = useStore((state) => state.selectDocument);
  const closeDocument = useStore((state) => state.closeDocument);
  const saveDocument = useSaveDocument();

  // The document waiting on the unsaved-changes dialog
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmDoc = documents.find((d) => d.id === confirmId);

  const requestClose = useCallback(
    (id: string) => {
      const doc = useStore.getState().documents.find((d) => d.id === id);
      if (!doc) return;
      if (hasUnsavedChanges(doc)) setConfirmId(id);
      else closeDocument(id);
    },
    [closeDocument]
  );

  const cancel = useCallback(() => setConfirmId(null), []);

  const saveThenClose = useCallback(async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    // Cancelling the save panel, or a failed save, keeps the document open.
    if (await saveDocument(id)) closeDocument(id);
  }, [confirmId, saveDocument, closeDocument]);

  const discard = useCallback(() => {
    if (!confirmId) return;
    closeDocument(confirmId);
    setConfirmId(null);
  }, [confirmId, closeDocument]);

  return (
    <>
      <ul className="space-y-1">
        {documents.map((doc) => {
          const unsaved = hasUnsavedChanges(doc);
          return (
            <li key={doc.id} className="group relative">
              <button
                onClick={() => selectDocument(doc.id)}
                className={cn(
                  "w-full text-left pl-3 pr-9 py-2 rounded flex items-center gap-2 text-sm transition-colors",
                  currentDocument?.id === doc.id
                    ? "bg-bg-highlight text-text-invert"
                    : "text-dropdown-link hover:bg-bg-highlight/50"
                )}
              >
                <FileText size={16} className="shrink-0" />
                <span className="truncate">{doc.title}</span>
              </button>
              <button
                onClick={() => requestClose(doc.id)}
                aria-label={`Close ${doc.title}${unsaved ? " (unsaved changes)" : ""}`}
                title={unsaved ? "Close (unsaved changes)" : "Close"}
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 size-6 rounded flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum",
                  unsaved
                    ? "text-red-300 hover:bg-red-300/15"
                    : "text-text-muted hover:text-text-invert hover:bg-bg-highlight"
                )}
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      <UnsavedChangesModal
        isOpen={confirmDoc !== undefined}
        documentTitle={confirmDoc?.title ?? ""}
        onSave={saveThenClose}
        onDiscard={discard}
        onCancel={cancel}
      />
    </>
  );
}
