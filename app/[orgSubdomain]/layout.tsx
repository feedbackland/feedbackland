import { ProcessAdminInviteParams } from "@/components/app/process-admin-invite-params";
import { SubscriptionListener } from "@/components/app/subscription-listener";
import { GlobalOrgState } from "@/components/app/global-org-state";
import PlatformRoot from "@/components/app/platform-root";
import { ClaimOrgBanner } from "@/components/app/claim-org-banner";
import { ProcessPreviewParam } from "@/components/app/process-preview-param";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalOrgState />
      <SubscriptionListener />
      <ProcessAdminInviteParams />
      <ProcessPreviewParam />
      <ClaimOrgBanner />
      <PlatformRoot>{children}</PlatformRoot>
    </>
  );
}
