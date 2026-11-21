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

/** Shows the macOS save panel and writes the file. Resolves null if the user cancels. */
export async function saveLocalFileAs(
  content: string,
  suggestedName: string,
  currentPath?: string
): Promise<SavedFile | null> {
  const t = tauri();
  if (!t) throw new Error("Saving to disk needs the Dillinger desktop app");
  return t.invoke<SavedFile | null>("save_file_as", {
    content,
    suggestedName,
    currentPath: currentPath ?? null,
  });
}

/** Opens the macOS print dialog for the page (WKWebView does not act on window.print()). */
export async function printPage(): Promise<void> {
  const t = tauri();
  if (!t) throw new Error("Native printing needs the Dillinger desktop app");
  await t.invoke("print_page");
}

export async function saveLocalFile(path: string, content: string): Promise<void> {
  const t = tauri();
  if (!t) throw new Error("Saving to disk needs the Dillinger desktop app");
  await t.invoke("save_file", { path, content });
}
