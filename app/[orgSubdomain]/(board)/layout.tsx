import { ProcessAdminInviteParams } from "@/components/app/process-admin-invite-params";
import { GlobalOrgState } from "@/components/app/global-org-state";
import PlatformRoot from "@/components/app/platform-root";
import { PlatformReadySignal } from "@/components/app/platform-ready-signal";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PlatformReadySignal />
      <GlobalOrgState />
      <ProcessAdminInviteParams />
      <PlatformRoot>{children}</PlatformRoot>
    </>
  );
}
