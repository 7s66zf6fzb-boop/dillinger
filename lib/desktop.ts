"use client";

// Bridge to the Tauri desktop shell (packages/desktop). In a normal browser none of this exists.

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
}

interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

/** Event the desktop shell dispatches on window when Finder opens files while the app runs. */
export const FILES_OPENED_EVENT = "dillinger:files-opened";

function tauri(): TauriInternals | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
}

export function isDesktopApp(): boolean {
  return tauri() !== undefined;
}

export async function takeOpenedFiles(): Promise<OpenedFile[]> {
  const t = tauri();
  return t ? t.invoke<OpenedFile[]>("take_opened_files") : [];
}

export interface SavedFile {
  path: string;
  name: string;
}

// One save panel at a time, whether Save, Save As or Export opened it.
let savePanelOpen = false;

/**
 * Shows the macOS save panel and writes the file. Resolves null if the user cancels; throws if
 * a save panel is already open, so the caller can say so instead of silently doing nothing.
 */
export async function saveLocalFileAs(
  content: string,
  suggestedName: string,
  currentPath?: string
): Promise<SavedFile | null> {
  const t = tauri();
  if (!t) throw new Error("Saving to disk needs the Dillinger desktop app");
  if (savePanelOpen) throw new Error("A save panel is already open.");
  savePanelOpen = true;
  try {
    return await t.invoke<SavedFile | null>("save_file_as", {
      content,
      suggestedName,
      currentPath: currentPath ?? null,
    });
  } finally {
    savePanelOpen = false;
  }
}

/** Opens the macOS print dialog for the page (WKWebView does not act on window.print()). */
export async function printPage(): Promise<void> {
  const t = tauri();
  if (!t) throw new Error("Native printing needs the Dillinger desktop app");
  await t.invoke("print_page");
}

/** Opens (or brings forward) the separate Markdown format tips window. */
export async function openTipsWindow(): Promise<void> {
  const t = tauri();
  if (!t) throw new Error("Separate windows need the Dillinger desktop app");
  await t.invoke("open_tips_window");
}

export async function saveLocalFile(path: string, content: string): Promise<void> {
  const t = tauri();
  if (!t) throw new Error("Saving to disk needs the Dillinger desktop app");
  await t.invoke("save_file", { path, content });
}
