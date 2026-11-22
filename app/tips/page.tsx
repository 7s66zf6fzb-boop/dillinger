import type { Metadata } from "next";
import { NightModeScript } from "@/components/ui/NightModeScript";
import { TipsWindow } from "./TipsWindow";

export const metadata: Metadata = {
  title: "Markdown Format Tips",
  robots: { index: false, follow: false },
};

/** The format tips on their own, for the separate window opened from the sidebar. */
export default function TipsPage() {
  return (
    <>
      <NightModeScript />
      <TipsWindow />
    </>
  );
}
