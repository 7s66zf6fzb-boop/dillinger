"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { renderSanitizedHtml } from "@/lib/preview-html";
import { ABOUT_DILLINGER_MD, CHEAT_SHEET_MD } from "@/lib/format-tips";
import { isDesktopApp, openTipsWindow } from "@/lib/desktop";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "cheat-sheet", label: "Cheat sheet", markdown: CHEAT_SHEET_MD },
  { id: "about", label: "About Dillinger", markdown: ABOUT_DILLINGER_MD },
] as const;

type TabId = (typeof TABS)[number]["id"];

// A ````example fence: shown as the Markdown as typed beside how it renders.
const EXAMPLE_FENCE = /^````example\n([\s\S]*?)\n````$/m;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Renders the tips; each example becomes a two-column Markdown | Result pair. */
export async function renderTips(markdown: string): Promise<string> {
  // split() with a capture group alternates: prose, example source, prose, …
  const parts = markdown.split(EXAMPLE_FENCE);
  const rendered = await Promise.all(
    parts.map(async (part, i) => {
      const html = await renderSanitizedHtml(part);
      if (i % 2 === 0) return html;
      return (
        '<div class="tip-example">' +
        '<div class="tip-col"><div class="tip-label">Markdown</div>' +
        `<pre class="tip-source"><code>${escapeHtml(part)}</code></pre></div>` +
        `<div class="tip-col"><div class="tip-label">Result</div><div class="tip-result">${html}</div></div>` +
        "</div>"
      );
    })
  );
  // Outside links open in the browser, so the tips stay where they are.
  return rendered
    .join("")
    .replace(/<a href="(https?:)/g, '<a target="_blank" rel="noopener noreferrer" href="$1');
}

/** Opens the tips in their own window, to keep beside the editor while typing. */
export async function openFormatTipsWindow(): Promise<void> {
  if (isDesktopApp()) {
    await openTipsWindow();
  } else {
    window.open("/tips", "dillinger-format-tips", "popup,width=640,height=860");
  }
}

interface Props {
  /** "sidebar": compact, on the dark sidebar. "window": the full page at /tips. */
  variant: "sidebar" | "window";
  /** Window variant: follows night mode. */
  night?: boolean;
}

export function FormatTips({ variant, night = false }: Props) {
  const [tab, setTab] = useState<TabId>("cheat-sheet");
  const [html, setHtml] = useState<Partial<Record<TabId, string>>>({});

  useEffect(() => {
    if (html[tab] !== undefined) return;
    let cancelled = false;
    const markdown = TABS.find((t) => t.id === tab)!.markdown;
    renderTips(markdown).then((rendered) => {
      if (!cancelled) setHtml((prev) => ({ ...prev, [tab]: rendered }));
    });
    return () => {
      cancelled = true;
    };
  }, [tab, html]);

  const sidebar = variant === "sidebar";

  return (
    <div className={cn(sidebar ? "pb-2" : "flex flex-col h-full")}>
      <div className={cn("flex items-center gap-1", sidebar ? "px-2 pb-2" : "px-6 py-3 border-b border-border-light")}>
        <div role="tablist" aria-label="Format tips" className="flex gap-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tips-tab-${variant}-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`tips-panel-${variant}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum",
                tab === t.id
                  ? sidebar
                    ? "bg-bg-highlight text-text-invert"
                    : "bg-plum/15 text-text-primary underline underline-offset-4 decoration-plum decoration-2"
                  : sidebar
                    ? "text-text-muted hover:text-text-invert"
                    : "text-text-primary/75 hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {sidebar && (
          <button
            onClick={() => void openFormatTipsWindow()}
            title="Open in a separate window"
            aria-label="Open format tips in a separate window"
            className="p-1 rounded text-text-muted hover:text-plum transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>

      <div
        id={`tips-panel-${variant}`}
        role="tabpanel"
        aria-labelledby={`tips-tab-${variant}-${tab}`}
        className={cn(
          "preview-html",
          sidebar
            ? "dark tips-compact px-2 text-[12px] [&_pre]:whitespace-pre-wrap [&_table]:block [&_table]:overflow-x-auto"
            : cn("flex-1 overflow-auto px-6 py-4", night && "dark")
        )}
        dangerouslySetInnerHTML={{ __html: html[tab] ?? "" }}
      />
    </div>
  );
}
