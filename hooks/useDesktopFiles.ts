"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/store";
import { useToast } from "@/components/ui/Toast";
import { ensureExtension } from "@/lib/document";
import {
  FILES_OPENED_EVENT,
  isDesktopApp,
  saveLocalFile,
  saveLocalFileAs,
  takeOpenedFiles,
} from "@/lib/desktop";

/**
 * In the desktop app: imports files opened from Finder, saves them back with Cmd/Ctrl+S,
 * and Save As (Cmd/Ctrl+Shift+S) to a location picked in the macOS save panel.
 * Pass ready=false until the store has hydrated, so opened files are not overwritten.
 */
export function useDesktopFiles(ready: boolean): void {
  const openLocalFile = useStore((state) => state.openLocalFile);
  const markLocalFileSaved = useStore((state) => state.markLocalFileSaved);
  const linkLocalFile = useStore((state) => state.linkLocalFile);
  const { notify } = useToast();

  useEffect(() => {
    if (!ready || !isDesktopApp()) return;

    const importOpened = async () => {
      try {
        const files = await takeOpenedFiles();
        for (const file of files) {
          openLocalFile(file.path, file.name, file.content);
        }
        if (files.length === 1) notify(`Opened "${files[0].name}"`);
        else if (files.length > 1) notify(`Opened ${files.length} files`);
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error));
      }
    };

    importOpened();
    window.addEventListener(FILES_OPENED_EVENT, importOpened);
    return () => window.removeEventListener(FILES_OPENED_EVENT, importOpened);
  }, [ready, openLocalFile, notify]);

  useEffect(() => {
    if (!ready || !isDesktopApp()) return;

    let panelOpen = false;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "s") return;
      e.preventDefault();

      const doc = useStore.getState().currentDocument;
      if (!doc) return;
      const body = doc.body;

      try {
        // Save As when asked, or when the document has never been saved to a file.
        if (e.shiftKey || !doc.localFile) {
          if (panelOpen) return;
          panelOpen = true;
          try {
            const saved = await saveLocalFileAs(
              body,
              ensureExtension(doc.title, ".md"),
              doc.localFile?.path
            );
            if (!saved) return;
            linkLocalFile(doc.id, saved.path, saved.name, body);
            notify(`Saved "${saved.name}"`);
          } finally {
            panelOpen = false;
          }
          return;
        }

        await saveLocalFile(doc.localFile.path, body);
        markLocalFileSaved(doc.id, body);
        notify(`Saved "${doc.localFile.path.split("/").pop()}"`);
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ready, markLocalFileSaved, linkLocalFile, notify]);
}
