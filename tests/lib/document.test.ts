import { describe, expect, it } from "vitest";
import {
  countDocumentStats,
  ensureExtension,
  hasUnsavedChanges,
  replaceExtension,
  sanitizeDownloadFilename,
} from "@/lib/document";
import { DEFAULT_DOCUMENT_BODY } from "@/lib/types";

describe("document helpers", () => {
  it("normalizes filenames for downloads and exports", () => {
    expect(sanitizeDownloadFilename("My File?.md")).toBe("My_File_.md");
    expect(ensureExtension("notes", "md")).toBe("notes.md");
    expect(replaceExtension("notes.md", "html")).toBe("notes.html");
  });

  it("counts words and characters", () => {
    expect(countDocumentStats("hello world")).toEqual({
      wordCount: 2,
      characterCount: 11,
    });
  });

  it("knows when closing a document would lose work", () => {
    const base = { id: "1", title: "a.md", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(hasUnsavedChanges({ ...base, body: "x", localFile: { path: "/a.md" } })).toBe(false);
    expect(hasUnsavedChanges({ ...base, body: "x", localFile: { path: "/a.md", unsaved: true } })).toBe(true);
    expect(hasUnsavedChanges({ ...base, body: "# notes" })).toBe(true);
    expect(hasUnsavedChanges({ ...base, body: "  " })).toBe(false);
    expect(hasUnsavedChanges({ ...base, body: DEFAULT_DOCUMENT_BODY })).toBe(false);
  });
});
