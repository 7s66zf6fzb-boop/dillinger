import type { Document } from "@/lib/types";
import { DEFAULT_DOCUMENT_BODY } from "@/lib/types";

/**
 * Whether closing the document would lose work: a file with edits not yet written to disk,
 * or a document never saved to a file that holds anything beyond the starter text.
 */
export function hasUnsavedChanges(doc: Document): boolean {
  if (doc.localFile) return doc.localFile.unsaved === true;
  const body = doc.body.trim();
  return body !== "" && body !== DEFAULT_DOCUMENT_BODY.trim();
}

const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".txt"] as const;
const HTML_EXTENSIONS = [".html", ".htm"] as const;

export const DEFAULT_DOCUMENT_TITLE = "Untitled Document.md";

export function isMarkdownFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function isHtmlFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return HTML_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function stripKnownExtension(filename: string): string {
  return filename.replace(/\.(md|markdown|txt|html|htm)$/i, "");
}

export function sanitizeDownloadFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function ensureExtension(filename: string, extension: string): string {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const trimmed = filename.trim() || "document";
  return trimmed.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? trimmed
    : `${trimmed}${normalizedExtension}`;
}

export function replaceExtension(filename: string, extension: string): string {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const trimmed = filename.trim();
  const base = stripKnownExtension(trimmed) || "document";
  return `${base}${normalizedExtension}`;
}

function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function countCharacters(content: string): number {
  return content.length;
}

export function countDocumentStats(content: string) {
  return {
    wordCount: countWords(content),
    characterCount: countCharacters(content),
  };
}
