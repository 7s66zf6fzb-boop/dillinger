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

export async function saveLocalFile(path: string, content: string): Promise<void> {
  const t = tauri();
  if (!t) throw new Error("Saving to disk needs the Dillinger desktop app");
  await t.invoke("save_file", { path, content });
}
