"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Makes an element `inert` (no focus, no clicks, hidden from assistive tech) while `inert` is
 * true. For panels that stay in the page while closed so they can animate. React 18 has no
 * inert prop, so the attribute is set directly. Pair it with aria-hidden for older readers.
 */
export function useInert<T extends HTMLElement>(inert: boolean): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.toggleAttribute("inert", inert);
  }, [inert]);

  return ref;
}
