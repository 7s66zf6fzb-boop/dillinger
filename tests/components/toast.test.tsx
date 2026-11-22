import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast, TOAST_EXIT_MS } from "@/components/ui/Toast";

function ToastTrigger({ message, duration }: { message: string; duration?: number }) {
  const { notify } = useToast();
  return (
    <button onClick={() => notify(message, duration)}>
      Show Toast
    </button>
  );
}

function MultiToastTrigger() {
  const { notify } = useToast();
  return (
    <>
      <button onClick={() => notify("First toast")}>First</button>
      <button onClick={() => notify("Second toast")}>Second</button>
    </>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with message text", async () => {
    renderWithProvider(<ToastTrigger message="Document saved!" />);

    await act(async () => {
      screen.getByRole("button", { name: "Show Toast" }).click();
    });

    expect(screen.getByText("Document saved!")).toBeVisible();
  });

  it("renders the notification container with status role", async () => {
    renderWithProvider(<ToastTrigger message="Hello" />);

    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute("aria-label", "Notifications");

    await act(async () => {
      screen.getByRole("button", { name: "Show Toast" }).click();
    });

    expect(screen.getByText("Hello")).toBeVisible();
  });

  it("auto-dismisses after duration", async () => {
    renderWithProvider(<ToastTrigger message="Temporary" duration={2000} />);

    await act(async () => {
      screen.getByRole("button", { name: "Show Toast" }).click();
    });
    expect(screen.getByText("Temporary")).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Still fading out
    expect(screen.getByText("Temporary")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Temporary")).not.toBeInTheDocument();
  });

  it("auto-dismisses with default 3000ms duration", async () => {
    renderWithProvider(<ToastTrigger message="Default timing" />);

    await act(async () => {
      screen.getByRole("button", { name: "Show Toast" }).click();
    });
    expect(screen.getByText("Default timing")).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText("Default timing")).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(1 + TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Default timing")).not.toBeInTheDocument();
  });

  it("shows multiple toasts simultaneously", async () => {
    renderWithProvider(<MultiToastTrigger />);

    await act(async () => {
      screen.getByRole("button", { name: "First" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Second" }).click();
    });

    expect(screen.getByText("First toast")).toBeVisible();
    expect(screen.getByText("Second toast")).toBeVisible();
  });

  it("dismisses only the clicked toast when two appear in the same millisecond", async () => {
    renderWithProvider(<MultiToastTrigger />);

    // Fake timers freeze Date.now(), so both toasts are created in the same millisecond.
    await act(async () => {
      screen.getByRole("button", { name: "First" }).click();
      screen.getByRole("button", { name: "Second" }).click();
    });

    await act(async () => {
      screen.getAllByRole("button", { name: "Dismiss notification" })[0].click();
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });

    expect(screen.queryByText("First toast")).not.toBeInTheDocument();
    expect(screen.getByText("Second toast")).toBeVisible();
  });

  it("dismisses a toast when clicking the dismiss button", async () => {
    renderWithProvider(<ToastTrigger message="Dismissible" duration={0} />);

    await act(async () => {
      screen.getByRole("button", { name: "Show Toast" }).click();
    });
    expect(screen.getByText("Dismissible")).toBeVisible();

    await act(async () => {
      screen.getByRole("button", { name: "Dismiss notification" }).click();
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS);
    });
    expect(screen.queryByText("Dismissible")).not.toBeInTheDocument();
  });

  it("useToast returns a no-op notify when outside provider", () => {
    function Standalone() {
      const { notify } = useToast();
      return <button onClick={() => notify("no-op")}>Trigger</button>;
    }

    render(<Standalone />);

    expect(() => {
      screen.getByRole("button", { name: "Trigger" }).click();
    }).not.toThrow();
  });
});
