"use client";

import { renderMarkdown } from "@/lib/markdown";

/** Markdown to the sanitized HTML the preview shows (and printing uses). */
export async function renderSanitizedHtml(markdown: string): Promise<string> {
  const [rawHtml, DOMPurify] = await Promise.all([renderMarkdown(markdown), import("dompurify")]);
  return DOMPurify.default.sanitize(rawHtml, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ADD_ATTR: ["target", "class", "data-line-start", "data-line-end"],
    FORBID_TAGS: ["script", "style"],
  });
}
