import type { Metadata } from "next";
import { AiSettingsPage } from "@/components/app/ai-settings/page";
export const metadata: Metadata = {
  title: "AI settings",
  referrer: "no-referrer",
};
export default function Page() {
  return <AiSettingsPage />;
}
