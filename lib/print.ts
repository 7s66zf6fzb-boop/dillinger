"use client";

import { isDesktopApp, printPage } from "@/lib/desktop";
import { stripKnownExtension } from "@/lib/document";
import { renderSanitizedHtml } from "@/lib/preview-html";

const PRINT_ROOT_ID = "print-root";

/**
 * Prints the document as the preview renders it, through the system print dialog (which
 * offers Save as PDF). Nothing is written to disk. The print stylesheet in globals.css hides
 * the app and shows only #print-root, which stays in the page (hidden on screen) so the
 * dialog can re-paginate while it is open.
 */
export async function printDocument(markdown: string, title: string): Promise<void> {
  let root = document.getElementById(PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PRINT_ROOT_ID;
    root.className = "preview-html";
    document.body.appendChild(root);
  }
  root.innerHTML = await renderSanitizedHtml(markdown);

  // The dialog suggests the page title as the PDF file name.
  const previousTitle = document.title;
  document.title = stripKnownExtension(title) || "Document";
  try {
    if (isDesktopApp()) {
      await printPage();
    } else {
      window.print();
    }
  } finally {
    setTimeout(() => {
      document.title = previousTitle;
    }, 2000);
  }
}
