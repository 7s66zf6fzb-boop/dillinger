"use client";

import { useEffect, useState, useRef } from "react";
import { useStore } from "@/stores/store";
import { renderSanitizedHtml } from "@/lib/preview-html";

export function MarkdownPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentDocument = useStore((state) => state.currentDocument);
  const enableScrollSync = useStore((state) => state.settings.enableScrollSync);
  const enableNightMode = useStore((state) => state.settings.enableNightMode);
  const editorScrollPercent = useStore((state) => state.editorScrollPercent);
  const editorTopLine = useStore((state) => state.editorTopLine);
  const [sanitizedHtml, setSanitizedHtml] = useState("");

  useEffect(() => {
    const body = currentDocument?.body;
    if (!body) {
      setSanitizedHtml("");
      return;
    }

    let cancelled = false;

    renderSanitizedHtml(body).then((clean) => {
      if (!cancelled) setSanitizedHtml(clean);
    });

    return () => {
      cancelled = true;
    };
  }, [currentDocument?.body]);

  // Scroll sync with editor
  useEffect(() => {
    if (!enableScrollSync || !containerRef.current) return;

    const container = containerRef.current;
    const lineAnchors = Array.from(
      container.querySelectorAll<HTMLElement>("[data-line-start]")
    );

    if (lineAnchors.length > 0) {
      let target = lineAnchors[0];

      for (const anchor of lineAnchors) {
        const startLine = Number(anchor.dataset.lineStart || "0");
        if (startLine <= editorTopLine) {
          target = anchor;
        } else {
          break;
        }
      }

      container.scrollTop = target.offsetTop;
      return;
    }

    const scrollHeight = container.scrollHeight - container.clientHeight;
    container.scrollTop = scrollHeight * editorScrollPercent;
  }, [editorScrollPercent, editorTopLine, sanitizedHtml, enableScrollSync]);

  if (!sanitizedHtml && !currentDocument?.body) {
    return (
      <div
        id="preview"
        data-testid="preview-pane"
        className={`h-full flex items-center justify-center ${
          enableNightMode ? 'bg-[#1e1e1e]' : 'bg-transparent'
        }`}
      >
        <p className="text-text-muted text-sm">Start typing to see a preview</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="preview"
      data-testid="preview-pane"
      className={`preview-html h-full overflow-auto p-6 ${
        enableNightMode ? 'dark bg-[#1e1e1e]' : 'bg-transparent'
      }`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
