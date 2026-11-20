"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/store";
import { useToast } from "@/components/ui/Toast";
import {
  FILES_OPENED_EVENT,
  isDesktopApp,
  saveLocalFile,
  takeOpenedFiles,
} from "@/lib/desktop";

/**
 * In the desktop app: imports files opened from Finder and saves them back with Cmd/Ctrl+S.
 * Pass ready=false until the store has hydrated, so opened files are not overwritten.
 */
export function useDesktopFiles(ready: boolean): void {
  const openLocalFile = useStore((state) => state.openLocalFile);
  const markLocalFileSaved = useStore((state) => state.markLocalFileSaved);
  const persist = useStore((state) => state.persist);
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

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "s") return;
      e.preventDefault();

      const doc = useStore.getState().currentDocument;
      if (!doc) return;

      if (!doc.localFile) {
        persist();
        notify("Saved in Dillinger");
        return;
      }

      const body = doc.body;
      try {
        await saveLocalFile(doc.localFile.path, body);
        markLocalFileSaved(doc.id, body);
        notify(`Saved "${doc.localFile.path.split("/").pop()}"`);
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ready, markLocalFileSaved, persist, notify]);
}
