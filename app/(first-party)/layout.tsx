import type { Metadata } from "next";
import { SurfaceProviders } from "@/providers/surface";
import { SettingsProvider } from "@/providers/settings";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function FirstPartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  return (
    <SurfaceProviders surface="first-party">
      <SettingsProvider initial={settings}>{children}</SettingsProvider>
    </SurfaceProviders>
  );
}
