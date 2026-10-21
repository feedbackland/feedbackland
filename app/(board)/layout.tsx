import { headers } from "next/headers";
import { BoardState } from "@/components/app/board-state";
import PlatformRoot from "@/components/app/platform-root";
import { PlatformReadySignal } from "@/components/app/platform-ready-signal";
import { EmbedProvider } from "@/providers/embed";
import { SettingsProvider } from "@/providers/settings";
import { getSettings } from "@/lib/settings";
import { EMBED_HEADER, parseEmbedSurface } from "@/lib/embed-surface";
export async function generateMetadata() {
  const settings = await getSettings();
  return {
    title: settings.platformTitle,
    description: settings.platformDescription,
    metadataBase: new URL(settings.appUrl),
  };
}
export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const surface = parseEmbedSurface((await headers()).get(EMBED_HEADER));
  return (
    <SettingsProvider initial={settings}>
      <EmbedProvider initialSurface={surface}>
        <PlatformReadySignal />
        <BoardState />
        <PlatformRoot>{children}</PlatformRoot>
      </EmbedProvider>
    </SettingsProvider>
  );
}
