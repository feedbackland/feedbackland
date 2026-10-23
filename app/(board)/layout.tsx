import { headers } from "next/headers";
import { BoardState } from "@/components/app/board-state";
import PlatformRoot from "@/components/app/platform-root";
import { PlatformReadySignal } from "@/components/app/platform-ready-signal";
import { EmbedProvider } from "@/providers/embed";
import { SettingsProvider } from "@/providers/settings";
import { SurfaceProviders } from "@/providers/surface";
import { getSettings } from "@/lib/settings";
import { EMBED_HEADER } from "@/lib/embed-surface";
import { getAppUrl } from "@/lib/app-url";
import { log } from "@/lib/log";
export async function generateMetadata() {
  const requestHeaders = await headers();
  try {
    const settings = await getSettings();
    const hint = requestHeaders.get(EMBED_HEADER);
    // Without a trusted hint the URL may resolve to a drawer after hydration.
    const index = settings.allowIndexing && hint === "first-party";
    return {
      title: settings.platformTitle,
      description: settings.platformDescription,
      metadataBase: new URL(settings.appUrl),
      robots: { index, follow: index, googleBot: { index, follow: index } },
      icons: { icon: settings.logoUrl ?? "/icon.svg" },
    };
  } catch {
    log("settings.metadata-unavailable", {}, "warn");
    return {
      title: "Feedback",
      metadataBase: new URL(getAppUrl(requestHeaders).appUrl),
      robots: { index: false, follow: false },
    };
  }
}
export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const hint = (await headers()).get(EMBED_HEADER);
  const surface =
    hint === "drawer" || hint === "first-party" ? hint : "unresolved";
  return (
    <EmbedProvider initialSurface={surface}>
      <SurfaceProviders>
        <SettingsProvider initial={settings}>
          <PlatformReadySignal />
          <BoardState />
          <PlatformRoot>{children}</PlatformRoot>
        </SettingsProvider>
      </SurfaceProviders>
    </EmbedProvider>
  );
}
