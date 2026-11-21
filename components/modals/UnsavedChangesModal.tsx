"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  documentTitle: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  isOpen,
  documentTitle,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    saveRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const buttonBase =
    "w-full py-2 px-4 rounded font-medium transition-opacity hover:opacity-90 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-navbar";

  // Portal to <body>: the sidebar's slide transform would otherwise confine "fixed" to it.
  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
      aria-describedby="unsaved-modal-description"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />

      <div className="relative bg-bg-navbar rounded-lg shadow-xl w-full max-w-sm p-6 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>

          <h2 id="unsaved-modal-title" className="text-lg font-semibold text-text-invert mb-2 text-balance">
            Unsaved changes
          </h2>

          <p id="unsaved-modal-description" className="text-text-muted text-sm mb-6">
            &quot;{documentTitle}&quot; has unsaved changes. Save them before closing?
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              ref={saveRef}
              onClick={onSave}
              className={`${buttonBase} bg-plum text-bg-navbar focus-visible:ring-plum`}
            >
              Save Changes
            </button>
            <button
              onClick={onDiscard}
              className={`${buttonBase} bg-red-600 text-white focus-visible:ring-red-400`}
            >
              Close without saving
            </button>
            <button
              onClick={onCancel}
              className={`${buttonBase} bg-bg-button-save text-text-invert focus-visible:ring-plum`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
