"use client";

import Link from "next/link";
import { HOMEPAGE_FEATURES, HOMEPAGE_FAQS } from "@/lib/homepage-content";

const ABOUT_LINKS: { href: string; label: string }[] = [
  { href: "/features", label: "Full feature list" },
  { href: "/guide", label: "Markdown guide" },
  { href: "/compare", label: "Compare alternatives" },
  { href: "/integrations", label: "Integrations" },
  { href: "/ai", label: "Markdown for AI" },
];

export function AboutPanel() {
  return (
    <div className="px-2 pb-2 text-sm text-dropdown-link leading-relaxed">
      <h2 className="text-text-invert font-semibold text-base leading-snug">
        Online Markdown Editor with Live Preview
      </h2>
      <p className="mt-1 text-text-muted">
        Dillinger is a free online markdown editor with live preview, cloud
        sync, and zero signup friction.
      </p>

      <div className="mt-3 space-y-3">
        <p>
          Dillinger is a free markdown editor that runs in your browser. Open
          it, start typing, and watch your text render in a live preview pane
          beside the editor. There is no signup, no paywall, and no install —
          just an online markdown editor that loads instantly and stays out of
          your way.
        </p>
        <p>
          Connect your cloud accounts to sync documents directly with GitHub,
          Dropbox, Google Drive, OneDrive, or Bitbucket. Drafts persist locally
          so your work survives a closed tab, and one-click export sends your
          document to Markdown, styled HTML, or PDF whenever you need to share
          it.
        </p>
        <p>
          Built on the Monaco editor that powers VS Code, Dillinger gives
          developers, technical writers, and AI builders a fast, keyboard-
          friendly surface for writing READMEs, documentation, blog posts, and
          LLM prompts. Vim and Emacs keybindings, dark mode, and a
          distraction-free zen mode are one click away.
        </p>
      </div>

      <h3 className="mt-5 text-text-invert font-semibold">
        Why writers pick Dillinger
      </h3>
      <ul className="mt-2 space-y-2">
        {HOMEPAGE_FEATURES.map((feature) => (
          <li key={feature.title}>
            <span className="text-plum font-medium">{feature.title}.</span>{" "}
            {feature.description}
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-text-invert font-semibold">
        Frequently asked questions
      </h3>
      <div className="mt-2 space-y-1">
        {HOMEPAGE_FAQS.map((faq) => (
          <details key={faq.question} className="group">
            <summary
              className="cursor-pointer py-1 rounded text-text-invert marker:text-text-muted
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
            >
              {faq.question}
            </summary>
            <p className="mt-1 mb-2 text-text-muted">{faq.answer}</p>
          </details>
        ))}
      </div>

      <ul className="mt-5 space-y-1">
        {ABOUT_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-plum hover:underline underline-offset-4 rounded
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
