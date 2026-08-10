import { headers } from "next/headers";
import { ProcessAdminInviteParams } from "@/components/app/process-admin-invite-params";
import { GlobalOrgState } from "@/components/app/global-org-state";
import PlatformRoot from "@/components/app/platform-root";
import { PlatformReadySignal } from "@/components/app/platform-ready-signal";
import { EmbedProvider } from "@/providers/embed";
import { EMBED_HEADER, parseEmbedSurface } from "@/lib/embed-surface";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved on the server (from the header the proxy derives from `?embed=`)
  // so the embedded board's very first paint is already its final layout.
  const embedSurface = parseEmbedSurface((await headers()).get(EMBED_HEADER));

  return (
    <EmbedProvider initialSurface={embedSurface}>
      <PlatformReadySignal />
      <GlobalOrgState />
      <ProcessAdminInviteParams />
      <PlatformRoot>{children}</PlatformRoot>
    </EmbedProvider>
  );
}
