import { ProcessAdminInviteParams } from "@/components/app/process-admin-invite-params";
import { SubscriptionListener } from "@/components/app/subscription-listener";
import { GlobalOrgState } from "@/components/app/global-org-state";
import PlatformRoot from "@/components/app/platform-root";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalOrgState />
      <SubscriptionListener />
      <ProcessAdminInviteParams />
      <PlatformRoot>{children}</PlatformRoot>
    </>
  );
}
