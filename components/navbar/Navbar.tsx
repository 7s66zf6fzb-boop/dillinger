"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/stores/store";
import { useToast } from "@/components/ui/Toast";
import { useImageUpload } from "@/hooks/useImageUpload";
import { importDocumentFile } from "@/lib/import";
import { isDesktopApp, saveLocalFileAs } from "@/lib/desktop";
import { ensureExtension } from "@/lib/document";
import {
  Menu,
  Eye,
  EyeOff,
  Settings,
  Download,
  FileText,
  FileCode,
  FileType,
  Maximize2,
  Upload,
  ImagePlus,
  HelpCircle,
} from "lucide-react";

type ExportFormat = "markdown" | "html" | "pdf";

function getDownloadFilename(response: Response, fallback: string): string {
  const contentDisposition = response.headers.get("Content-Disposition");
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

/**
 * The coding-symbol image drawn in currentColor (as a mask), so it matches the other navbar
 * icons and their hover color. Crossed: a slash like lucide's EyeOff, with a navbar-colored
 * halo that cuts a gap in the glyph the way EyeOff's eye is broken around its slash.
 */
function CodeIcon({ crossed }: { crossed: boolean }) {
  return (
    <span className="relative block size-5" aria-hidden="true">
      <span
        className="absolute inset-0 bg-current"
        style={{
          WebkitMaskImage: "url(/icons/coding-symbol.png)",
          maskImage: "url(/icons/coding-symbol.png)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
      {crossed && (
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-5" fill="none" strokeLinecap="round">
          <line x1="2" y1="2" x2="22" y2="22" className="stroke-bg-navbar" strokeWidth="5" />
          <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </span>
  );
}

export function Navbar() {
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const toggleSettings = useStore((state) => state.toggleSettings);
  const togglePreview = useStore((state) => state.togglePreview);
  const previewVisible = useStore((state) => state.previewVisible);
  const editorVisible = useStore((state) => state.editorVisible);
  const toggleEditor = useStore((state) => state.toggleEditor);
  const currentDocument = useStore((state) => state.currentDocument);
  const createImportedDocument = useStore((state) => state.createImportedDocument);
  const insertMarkdownAtCursor = useStore((state) => state.insertMarkdownAtCursor);
  const setZenMode = useStore((state) => state.setZenMode);
  const toggleShortcuts = useStore((state) => state.toggleShortcuts);
  const { notify } = useToast();
  const { upload } = useImageUpload();

  const [exportOpen, setExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on Escape key or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && exportOpen) {
        setExportOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [exportOpen]);

  const handleExport = useCallback(async (
    format: ExportFormat,
    options?: { styled?: boolean }
  ) => {
    if (!currentDocument) return;
    setExportOpen(false);

    const formatLabel = format === "html" && options?.styled
      ? "styled HTML"
      : format.toUpperCase();

    try {
      // Desktop app: ask where to put the Markdown copy instead of dropping it in Downloads.
      // The open document stays linked to its own file (this is a copy, not Save As).
      if (format === "markdown" && isDesktopApp()) {
        try {
          const saved = await saveLocalFileAs(
            currentDocument.body,
            ensureExtension(currentDocument.title, ".md")
          );
          if (saved) notify(`Exported "${saved.name}"`);
        } catch (error) {
          notify(error instanceof Error ? error.message : String(error));
        }
        return;
      }

      notify(`Preparing ${formatLabel}...`);

      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: currentDocument.body,
          title: currentDocument.title,
          styled: options?.styled,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getDownloadFilename(
        response,
        `${currentDocument.title}.${format === "markdown" ? "md" : format}`
      );
      a.click();
      URL.revokeObjectURL(url);

      notify(
        format === "html" && options?.styled === true
          ? "Exported as styled HTML"
          : `Exported as ${format.toUpperCase()}`
      );
    } catch (error) {
      if (error instanceof TypeError) {
        notify(`${formatLabel} export failed — check your connection`);
      } else {
        notify(`${formatLabel} export failed — please try again`);
      }
    }
  }, [currentDocument, notify]);

  const handleImportSelection = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const imported = await importDocumentFile(file);
      createImportedDocument(file.name, imported.body);
      notify(`Imported "${file.name}"`);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to import file"
      );
    }
  }, [createImportedDocument, notify]);

  const handleImageSelection = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const result = await upload(file);
    if (!result) {
      return;
    }

    insertMarkdownAtCursor(`\n${result.markdown}\n`);
  }, [upload, insertMarkdownAtCursor]);

  return (
    <nav className="h-14 bg-bg-navbar flex items-center justify-between px-4 z-navbar">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar rounded"
        >
          <Menu size={24} />
        </button>
        <span className="text-plum font-bold text-xl tracking-wide hidden sm:block">
          DILLINGER
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => importInputRef.current?.click()}
          aria-label="Import file"
          title="Import file"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] px-3 py-2
                     flex items-center gap-1 text-sm rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          <Upload size={18} />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          onClick={() => imageInputRef.current?.click()}
          aria-label="Insert image"
          title="Insert image"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] px-3 py-2
                     flex items-center gap-1 text-sm rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          <ImagePlus size={18} />
          <span className="hidden sm:inline">Image</span>
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            aria-expanded={exportOpen}
            aria-haspopup="menu"
            aria-label="Export document"
            className="text-text-invert hover:text-plum transition-all active:scale-[0.97] px-3 py-2
                       flex items-center gap-1 text-sm rounded
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export as</span>
          </button>
          {exportOpen && (
            <div
              role="menu"
              aria-label="Export formats"
              className="absolute right-0 top-full mt-1 bg-bg-navbar rounded shadow-lg py-1 min-w-[150px] animate-fade-in"
            >
              <button
                role="menuitem"
                onClick={() => handleExport("markdown")}
                className="w-full px-4 py-2 text-left text-text-invert hover:bg-bg-highlight
                           flex items-center gap-2 text-sm
                           focus-visible:outline-none focus-visible:bg-bg-highlight"
              >
                <FileText size={16} />
                Markdown
              </button>
              <button
                role="menuitem"
                onClick={() => handleExport("html", { styled: false })}
                className="w-full px-4 py-2 text-left text-text-invert hover:bg-bg-highlight
                           flex items-center gap-2 text-sm
                           focus-visible:outline-none focus-visible:bg-bg-highlight"
              >
                <FileCode size={16} />
                HTML
              </button>
              <button
                role="menuitem"
                onClick={() => handleExport("html", { styled: true })}
                className="w-full px-4 py-2 text-left text-text-invert hover:bg-bg-highlight
                           flex items-center gap-2 text-sm
                           focus-visible:outline-none focus-visible:bg-bg-highlight"
              >
                <FileCode size={16} />
                Styled HTML
              </button>
              <button
                role="menuitem"
                onClick={() => handleExport("pdf")}
                className="w-full px-4 py-2 text-left text-text-invert hover:bg-bg-highlight
                           flex items-center gap-2 text-sm
                           focus-visible:outline-none focus-visible:bg-bg-highlight"
              >
                <FileType size={16} />
                PDF
              </button>
            </div>
          )}
        </div>

        {/* Editor toggle */}
        <button
          onClick={toggleEditor}
          aria-label={editorVisible ? "Hide editor" : "Show editor"}
          title={editorVisible ? "Hide editor" : "Show editor"}
          aria-pressed={editorVisible}
          aria-controls="editor-pane"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] p-2 rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          <CodeIcon crossed={!editorVisible} />
        </button>

        {/* Preview toggle */}
        <button
          onClick={togglePreview}
          aria-label={previewVisible ? "Hide preview" : "Show preview"}
          title={previewVisible ? "Hide preview" : "Show preview"}
          aria-pressed={previewVisible}
          aria-controls="preview-pane"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] p-2 rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          {previewVisible ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>

        {/* Zen mode */}
        <button
          onClick={() => setZenMode(true)}
          aria-label="Enter zen mode"
          title="Zen mode (⌘⇧Z)"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] p-2 rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          <Maximize2 size={20} />
        </button>

        {/* Settings */}
        <button
          onClick={toggleSettings}
          aria-label="Open settings"
          title="Settings"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] p-2 rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          <Settings size={20} />
        </button>

        <button
          onClick={toggleShortcuts}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="text-text-invert hover:text-plum transition-all active:scale-[0.97] p-2 rounded
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar"
        >
          <HelpCircle size={20} />
        </button>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".md,.markdown,.txt,.html,.htm,text/plain,text/markdown,text/html"
        data-testid="document-import-input"
        className="hidden"
        onChange={handleImportSelection}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        data-testid="image-import-input"
        className="hidden"
        onChange={handleImageSelection}
      />
    </nav>
  );
}
