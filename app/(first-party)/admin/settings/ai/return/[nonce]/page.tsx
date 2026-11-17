import type { Metadata } from "next";
import { ConnectReturn } from "@/components/app/ai-settings/return";
export const metadata: Metadata = {
  title: "Connect OpenRouter",
  referrer: "no-referrer",
  robots: { index: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ nonce: string }>;
}) {
  return <ConnectReturn nonce={(await params).nonce} />;
}
