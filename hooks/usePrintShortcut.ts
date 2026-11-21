"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/store";
import { useToast } from "@/components/ui/Toast";
import { printDocument } from "@/lib/print";

/** Cmd/Ctrl+P prints the current document (as rendered) through the system print dialog. */
export function usePrintShortcut(): void {
  const { notify } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "p") return;
      e.preventDefault();
      e.stopPropagation();

      const doc = useStore.getState().currentDocument;
      if (!doc) return;
      printDocument(doc.body, doc.title).catch((error) =>
        notify(error instanceof Error ? error.message : "Could not open the print dialog")
      );
    };

    // Capture phase, so the editor never sees the shortcut first.
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [notify]);
}
