import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/ui/Skeleton";
import { HOMEPAGE_FAQS } from "@/lib/homepage-content";
import { NightModeScript } from "@/components/ui/NightModeScript";

export const metadata: Metadata = {
  title: "Markdown Editor — Online, Free, with Live Preview | Dillinger",
  description:
    "Free online Markdown editor with live preview. Write, format, and export Markdown to HTML or PDF — sync to GitHub, Dropbox & Google Drive. No signup.",
  alternates: { canonical: "https://dillinger.io" },
  openGraph: {
    title: "Markdown Editor — Online, Free, with Live Preview | Dillinger",
    description:
      "Free online Markdown editor with live preview. Write, format, and export Markdown to HTML or PDF — sync to GitHub, Dropbox & Google Drive. No signup.",
    url: "https://dillinger.io",
  },
  twitter: {
    title: "Markdown Editor — Online, Free, with Live Preview | Dillinger",
    description:
      "Free online Markdown editor with live preview. Write, format, and export Markdown to HTML or PDF — sync to GitHub, Dropbox & Google Drive. No signup.",
  },
};

export const dynamic = "force-dynamic";

const Editor = nextDynamic(
  () => import("@/components/editor/EditorContainer").then((mod) => mod.EditorContainer),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOMEPAGE_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function Page() {
  return (
    <>
      <NightModeScript />
      <Editor />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_JSON_LD),
        }}
      />
    </>
  );
}
