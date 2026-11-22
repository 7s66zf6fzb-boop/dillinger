import { afterEach, describe, expect, it, vi } from "vitest";
import { saveLocalFileAs } from "@/lib/desktop";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function stubTauri(invoke: Invoke) {
  (window as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } }).__TAURI_INTERNALS__ = { invoke };
}

afterEach(() => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("saveLocalFileAs", () => {
  it("opens one save panel at a time", async () => {
    let finish: (value: unknown) => void = () => {};
    const invoke = vi.fn<Invoke>(() => new Promise((resolve) => (finish = resolve)));
    stubTauri(invoke);

    const first = saveLocalFileAs("a", "A.md");
    // A second Save or Export while the panel is up is refused with a reason
    await expect(saveLocalFileAs("b", "B.md")).rejects.toThrow("already open");
    expect(invoke).toHaveBeenCalledTimes(1);

    finish({ path: "/tmp/A.md", name: "A.md" });
    await expect(first).resolves.toEqual({ path: "/tmp/A.md", name: "A.md" });

    // Once it closes, the next save can open one again
    invoke.mockResolvedValueOnce(null);
    await expect(saveLocalFileAs("c", "C.md")).resolves.toBeNull();
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("frees the panel after a failed save", async () => {
    stubTauri(vi.fn<Invoke>().mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce(null));

    await expect(saveLocalFileAs("a", "A.md")).rejects.toThrow("disk full");
    await expect(saveLocalFileAs("a", "A.md")).resolves.toBeNull();
  });
});
