import { describe, expect, it } from "vitest";
import { renderTips } from "@/components/tips/FormatTips";

const FENCE = "````";

describe("renderTips", () => {
  it("shows each example as its Markdown beside the rendered result", async () => {
    const html = await renderTips(`Intro **text**\n\n${FENCE}example\n**bold** <b>x</b>\n${FENCE}\n\nAfter`);
    const root = document.createElement("div");
    root.innerHTML = html;

    expect(root.querySelector("strong")?.textContent).toBe("text");
    const example = root.querySelector(".tip-example");
    expect(example).not.toBeNull();
    // Source column: the Markdown as typed, escaped, not rendered
    expect(example?.querySelector(".tip-source code")?.textContent).toBe("**bold** <b>x</b>");
    // Result column: rendered
    expect(example?.querySelector(".tip-result strong")?.textContent).toBe("bold");
    expect(root.textContent).toContain("After");
  });

  it("keeps a nested code fence inside one example", async () => {
    const html = await renderTips(`${FENCE}example\n\`\`\`js\nlet a = 1;\n\`\`\`\n${FENCE}`);
    const root = document.createElement("div");
    root.innerHTML = html;

    expect(root.querySelectorAll(".tip-example")).toHaveLength(1);
    expect(root.querySelector(".tip-source code")?.textContent).toContain("\`\`\`js");
    expect(root.querySelector(".tip-result pre")?.textContent).toContain("let a = 1;");
  });

  it("sanitizes the result and opens outside links in a new window", async () => {
    const html = await renderTips(`${FENCE}example\n<img src=x onerror="alert(1)"> [site](https://example.com)\n${FENCE}`);

    const root = document.createElement("div");
    root.innerHTML = html;

    // The source column shows the attack as text; the result has no live handler
    expect(root.querySelector(".tip-source code")?.textContent).toContain('onerror="alert(1)"');
    expect(root.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(html).toContain('target="_blank" rel="noopener noreferrer" href="https://example.com"');
  });
});
