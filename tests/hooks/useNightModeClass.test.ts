import { afterEach, describe, expect, it } from "vitest";
import { StrictMode, createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { useStore } from "@/stores/store";
import { useNightModeClass } from "@/hooks/useNightModeClass";

const initialState = useStore.getState();
const strict = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);

function setStore(enableNightMode: boolean, hydrated = true) {
  useStore.setState({ hydrated, settings: { ...useStore.getState().settings, enableNightMode } });
}

afterEach(() => {
  useStore.setState(initialState, true);
  document.documentElement.classList.remove("dark");
});

describe("useNightModeClass", () => {
  it("follows the night mode setting", () => {
    setStore(true);
    renderHook(() => useNightModeClass(), { wrapper: strict });
    expect(document.documentElement).toHaveClass("dark");

    act(() => setStore(false));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("removes the class when the editor unmounts, so other pages stay light", () => {
    setStore(true);
    const { unmount } = renderHook(() => useNightModeClass());
    unmount();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("keeps the class the pre-paint script set until saved settings load (also in Strict Mode)", () => {
    document.documentElement.classList.add("dark");
    setStore(false, false);
    renderHook(() => useNightModeClass(), { wrapper: strict });
    expect(document.documentElement).toHaveClass("dark");

    act(() => setStore(true, true));
    expect(document.documentElement).toHaveClass("dark");
  });
});
