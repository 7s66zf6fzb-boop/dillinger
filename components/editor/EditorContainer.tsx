"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import dynamic from "next/dynamic";
import { X, Upload } from "lucide-react";
import { Navbar } from "@/components/navbar/Navbar";
import { LogoBar } from "@/components/ads/LogoBar";
import { DocumentTitle } from "@/components/editor/DocumentTitle";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { KeyboardShortcuts } from "@/components/ui/KeyboardShortcuts";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/stores/store";
import { EditorSkeleton } from "@/components/ui/Skeleton";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useDesktopFiles } from "@/hooks/useDesktopFiles";
import { usePrintShortcut } from "@/hooks/usePrintShortcut";
import { importDocumentFile } from "@/lib/import";
import { cn } from "@/lib/utils";

// Dynamic import Sidebar to prevent SSR issues with GitHub/Dropbox hooks
const Sidebar = dynamic(
  () => import("@/components/sidebar/Sidebar").then((mod) => mod.Sidebar),
  { ssr: false }
);

const DropZoneOverlay = memo(function DropZoneOverlay({
  isDragging,
}: {
  isDragging: boolean;
}) {
  if (!isDragging) return null;

  return (
    <div
      className="absolute inset-0 z-modal bg-bg-primary/90 flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="size-20 rounded-full bg-plum/20 flex items-center justify-center">
          <Upload size={40} className="text-plum" />
        </div>
        <div>
          <p className="text-xl font-semibold text-text-invert">
            Drop your file here
          </p>
          <p className="text-text-muted mt-1">
            Supports markdown, HTML, and image files
          </p>
        </div>
      </div>
    </div>
  );
});

const WIDE_QUERY = "(min-width: 640px)"; // Tailwind's sm breakpoint

function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isWide;
}

function useLastNonZero(value: number, initial: number): number {
  const last = useRef(value || initial);
  if (value > 0) last.current = value;
  return last.current;
}

/** True when the latest width change opened or closed the pane (to or from zero). */
function useIsSliding(width: number): boolean {
  const previous = useRef(width);
  const sliding = useRef(false);
  if (width !== previous.current) {
    sliding.current = width === 0 || previous.current === 0;
    previous.current = width;
  }
  return sliding.current;
}

function EditorContent() {
  const previewVisible = useStore((state) => state.previewVisible);
  const editorVisible = useStore((state) => state.editorVisible);
  const currentDocument = useStore((state) => state.currentDocument);
  const createImportedDocument = useStore((state) => state.createImportedDocument);
  const insertMarkdownAtCursor = useStore((state) => state.insertMarkdownAtCursor);
  const zenMode = useStore((state) => state.zenMode);
  const setZenMode = useStore((state) => state.setZenMode);
  const isDirty = useStore((state) => state.isDirty);
  const shortcutsOpen = useStore((state) => state.shortcutsOpen);
  const toggleShortcuts = useStore((state) => state.toggleShortcuts);
  const { notify } = useToast();
  const { upload } = useImageUpload();

  useDesktopFiles(currentDocument !== null);
  usePrintShortcut();

  // Pane widths, as a percentage of the pane row. Below the sm breakpoint only one pane fits.
  const isWide = useIsWide();
  const editorWidth = editorVisible ? (previewVisible && isWide ? 50 : 100) : 0;
  const previewWidth = previewVisible ? (editorVisible ? (isWide ? 50 : 0) : 100) : 0;
  // While a pane slides shut its content keeps the width it had open, so it moves out
  // rather than squashing.
  const editorOpenWidth = useLastNonZero(editorWidth, 50);
  // The editor pins to its right edge only while sliding in or out; when it just widens
  // (the preview closing) it pins left, so its text stays in place instead of being clipped.
  const editorSliding = useIsSliding(editorWidth);
  const previewOpenWidth = useLastNonZero(previewWidth, 50);

  const [isDragging, setIsDragging] = useState(false);
  const [, setDragCounter] = useState(0);

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];
      const isImage = file.type.startsWith("image/");

      if (isImage) {
        const result = await upload(file);
        if (result) {
          insertMarkdownAtCursor(`\n${result.markdown}\n`);
        }
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
    },
    [createImportedDocument, insertMarkdownAtCursor, notify, upload]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Keyboard shortcuts for zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + Z for zen mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        setZenMode(!zenMode);
      }
      // Escape to exit zen mode
      if (e.key === "Escape" && zenMode) {
        setZenMode(false);
      }
      // ? to open keyboard shortcuts
      if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !document.querySelector(".monaco-editor")?.contains(e.target as Node)
      ) {
        toggleShortcuts();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [zenMode, setZenMode, toggleShortcuts]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Show structural skeleton while hydrating
  if (!currentDocument) {
    return <EditorSkeleton />;
  }

  // Zen mode - fullscreen distraction-free editor
  if (zenMode) {
    return (
      <div
        className="h-dvh bg-bg-primary flex items-center justify-center relative animate-fade-in"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DropZoneOverlay isDragging={isDragging} />

        <div className="w-full max-w-3xl h-full py-12 px-4 relative">
          <button
            onClick={() => setZenMode(false)}
            className="absolute top-4 right-4 text-text-muted hover:text-text-invert transition-colors rounded
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
            aria-label="Exit zen mode"
          >
            <X size={24} />
          </button>
          <div className="h-full border border-border-light rounded-lg overflow-hidden">
            <MonacoEditor />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-dvh flex overflow-hidden relative animate-fade-in"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <DropZoneOverlay isDragging={isDragging} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <DocumentTitle />

        {/* Editor + Preview. Both stay mounted; a closing pane slides toward its own edge
            (editor left, preview right) while the other grows into the space. */}
        <div className="flex-1 flex min-h-0 overflow-hidden [container-type:inline-size]">
          <div
            id="editor-pane"
            aria-hidden={editorWidth === 0}
            inert={editorWidth === 0 ? true : undefined}
            className={cn(
              "relative shrink-0 overflow-hidden",
              editorWidth === 0 && "invisible",
              // visibility switches at the end of the slide when closing, at the start when opening
              "transition-[width,visibility] duration-300 ease-in-out motion-reduce:transition-none",
              editorWidth > 0 && previewWidth > 0 && "border-r border-border-light"
            )}
            style={{ width: `${editorWidth}%` }}
          >
            {/* Pinned right while sliding, so shrinking the pane carries it off to the left */}
            <div
              className={cn("absolute inset-y-0", editorSliding ? "right-0" : "left-0")}
              style={{ width: `${editorOpenWidth}cqw` }}
            >
              <MonacoEditor />
            </div>
          </div>

          <div
            id="preview-pane"
            aria-hidden={previewWidth === 0}
            inert={previewWidth === 0 ? true : undefined}
            className={cn(
              "relative shrink-0 overflow-hidden bg-[#FAFBFC]",
              previewWidth === 0 && "invisible",
              "transition-[width] duration-300 ease-in-out motion-reduce:transition-none"
            )}
            style={{ width: `${previewWidth}%` }}
          >
            {/* Anchored to the left edge, so shrinking the pane carries it off to the right */}
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${previewOpenWidth}cqw` }}
            >
              <MarkdownPreview />
            </div>
          </div>
        </div>
        <LogoBar />
      </main>

      <SettingsModal />
      <KeyboardShortcuts isOpen={shortcutsOpen} onClose={toggleShortcuts} />
    </div>
  );
}

export function EditorContainer() {
  return <EditorContent />;
}
