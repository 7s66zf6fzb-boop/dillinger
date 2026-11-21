// Copy shown in the sidebar "About" section. HOMEPAGE_FAQS also feeds the
// FAQPage JSON-LD on the home page, so keep the two in sync by editing here.

export const HOMEPAGE_FEATURES: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "Live Preview",
    description:
      "Watch your markdown render in real time, side-by-side, with synced scrolling.",
  },
  {
    title: "No Signup",
    description:
      "Open the editor and start writing. Documents persist locally in your browser — no account required.",
  },
  {
    title: "Cloud Sync",
    description:
      "Save and load files from GitHub, Dropbox, Google Drive, OneDrive, and Bitbucket.",
  },
  {
    title: "Export Anywhere",
    description:
      "Download your work as Markdown, styled HTML, or PDF with one click.",
  },
  {
    title: "Monaco Editor",
    description:
      "The same editing engine that powers VS Code, with Vim and Emacs keybindings on demand.",
  },
  {
    title: "Zen Mode",
    description:
      "Strip the chrome and write in a focused, full-screen, distraction-free view.",
  },
  {
    title: "AI-Ready",
    description:
      "Markdown is the native language of LLMs. Draft prompts and structured content for ChatGPT, Claude, or any AI workflow.",
  },
  {
    title: "Works Offline",
    description:
      "Once loaded, the editor keeps working without a network. Your drafts stay in local storage.",
  },
];

export const HOMEPAGE_FAQS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "What is the best free online markdown editor?",
    answer:
      "Dillinger is widely considered one of the best free online markdown editors because it combines a Monaco-powered editor, live preview, and cloud sync to GitHub, Dropbox, Google Drive, OneDrive, and Bitbucket — with no signup, no paywall, and no usage limits.",
  },
  {
    question: "Does Dillinger require a signup?",
    answer:
      "No. You can open dillinger.io and start writing immediately. Accounts are only needed if you want to connect a third-party service like GitHub or Dropbox to sync files.",
  },
  {
    question: "Does Dillinger support live preview?",
    answer:
      "Yes. Dillinger renders your markdown to HTML in real time as you type, with a side-by-side preview pane and synced scrolling so the editor and preview stay aligned.",
  },
  {
    question: "Can I sync Dillinger with GitHub, Dropbox, or Google Drive?",
    answer:
      "Yes. Dillinger has built-in OAuth integrations for GitHub, Dropbox, Google Drive, OneDrive, and Bitbucket. You can import existing markdown files, save changes back to the same repo or folder, and switch between providers without losing your work.",
  },
  {
    question: "Can I export markdown to PDF or HTML?",
    answer:
      "Yes. Dillinger exports the current document as raw Markdown, styled HTML, or PDF with a single click from the export menu — no plugins or external tooling required.",
  },
  {
    question: "How is Dillinger different from StackEdit or Typora?",
    answer:
      "Dillinger is a free, open-source web app focused on speed, live preview, and direct cloud sync — no installation and no paid tiers. StackEdit is also browser-based but heavier and slower to start, while Typora is a paid desktop application without browser-based editing or built-in cloud OAuth.",
  },
  {
    question: "Is Dillinger free?",
    answer:
      "Yes. Dillinger is completely free to use, has no paid tiers, and does not require a credit card or signup. The project is open source on GitHub.",
  },
  {
    question: "Does Dillinger work offline?",
    answer:
      "Yes. After the initial load, the editor continues to work without an internet connection and your documents are auto-saved to your browser's local storage. Cloud sync features require connectivity, but core editing and preview do not.",
  },
];
