"use client";

import { useEffect, useState } from "react";
import { FormatTips } from "@/components/tips/FormatTips";

function savedNightMode(): boolean {
  try {
    return JSON.parse(localStorage.getItem("profileV3") || "{}").enableNightMode === true;
  } catch {
    return false;
  }
}

export function TipsWindow() {
  // null until the saved setting is read; NightModeScript has applied it before paint
  const [night, setNight] = useState<boolean | null>(null);

  // Follow night mode, including when it is switched in the editor window.
  useEffect(() => {
    setNight(savedNightMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "profileV3") setNight(savedNightMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (night === null) return;
    document.documentElement.classList.toggle("dark", night);
  }, [night]);

  return (
    <main className="h-dvh bg-bg-primary text-text-primary">
      <h1 className="sr-only">Markdown Format Tips</h1>
      <FormatTips variant="window" night={night === true} />
    </main>
  );
}
