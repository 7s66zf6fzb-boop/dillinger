"use client";

import { useEffect } from "react";
import { useStore } from "@/stores/store";

/**
 * Puts the `dark` class on <html> while night mode is on, which switches the theme colors in
 * app/globals.css. Used by the editor only, and removed again on unmount, so the marketing
 * pages (reached by in-app links) keep their light design.
 */
export function useNightModeClass(): void {
  const enableNightMode = useStore((state) => state.settings.enableNightMode);
  const hydrated = useStore((state) => state.hydrated);

  useEffect(() => {
    // Until the saved settings load, the store holds the default; NightModeScript has already
    // applied the saved setting, so leave the class alone.
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", enableNightMode);
    return () => document.documentElement.classList.remove("dark");
  }, [enableNightMode, hydrated]);
}
