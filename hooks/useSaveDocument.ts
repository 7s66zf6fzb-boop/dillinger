"use client";

import { useCallback } from "react";
import { useStore } from "@/stores/store";
import { useToast } from "@/components/ui/Toast";
import { ensureExtension, sanitizeDownloadFilename } from "@/lib/document";
import { isDesktopApp, saveLocalFile, saveLocalFileAs } from "@/lib/desktop";

export interface SaveOptions {
  /** Always ask where to save (Save As). */
  saveAs?: boolean;
  /** No toast on success (autosave). */
  quiet?: boolean;
}

/**
 * Saves a document. Desktop app: back to its file, or through the macOS save panel when it
 * has no file yet or saveAs is set. Browser: downloads it as Markdown.
 * Resolves true when saved, false when cancelled or failed.
 */
export function useSaveDocument(): (id: string, options?: SaveOptions) => Promise<boolean> {
  const markLocalFileSaved = useStore((state) => state.markLocalFileSaved);
  const linkLocalFile = useStore((state) => state.linkLocalFile);
  const { notify } = useToast();

  return useCallback(
    async (id: string, { saveAs = false, quiet = false }: SaveOptions = {}) => {
      const doc = useStore.getState().documents.find((d) => d.id === id);
      if (!doc) return false;
      const body = doc.body;
      const filename = ensureExtension(doc.title, ".md");

      try {
        if (!isDesktopApp()) {
          const url = URL.createObjectURL(new Blob([body], { type: "text/markdown" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = sanitizeDownloadFilename(filename);
          a.click();
          URL.revokeObjectURL(url);
          if (!quiet) notify(`Downloaded "${filename}"`);
          return true;
        }

        if (saveAs || !doc.localFile) {
          const saved = await saveLocalFileAs(body, filename, doc.localFile?.path);
          if (!saved) return false;
          linkLocalFile(doc.id, saved.path, saved.name, body);
          if (!quiet) notify(`Saved "${saved.name}"`);
          return true;
        }

        await saveLocalFile(doc.localFile.path, body);
        markLocalFileSaved(doc.id, body);
        if (!quiet) notify(`Saved "${doc.localFile.path.split("/").pop()}"`);
        return true;
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [markLocalFileSaved, linkLocalFile, notify]
  );
}
