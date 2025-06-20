import { ClaimOrgBanner } from "@/components/app/claim-org-banner";
import { ProcessAdminInviteParams } from "@/components/app/process-admin-invite-params";
import { ProcessModeParam } from "@/components/app/process-mode-param";
import { SubscriptionListener } from "@/components/app/subscription-listener";
import { GlobalOrgState } from "@/components/app/global-org-state";
import PlatformRoot from "@/components/app/platform-root";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalOrgState />
      <ClaimOrgBanner />
      <SubscriptionListener />
      <ProcessModeParam />
      <ProcessAdminInviteParams />
      <PlatformRoot>{children}</PlatformRoot>
    </>
  );
}
