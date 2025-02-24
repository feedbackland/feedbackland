import { getSession, getSubdomain } from "@/lib/server/utils";
import { getOrg, getIsAdmin } from "@/lib/queries";
import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";
import { ResetPasswordDialog } from "@/components/app/reset-password/dialog";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const subdomain = await getSubdomain();
  const session = await getSession();
  const userId = session?.user?.id;
  const org = await getOrg({ orgSubdomain: subdomain });
  const orgId = org?.id;
  const orgName = org?.name;
  const isOrgClaimed = !!org?.isClaimed;
  const isSignedIn = !!session;
  const isAdmin = !!(userId && orgId && (await getIsAdmin({ userId, orgId })));

  if (org && orgId && orgName) {
    return (
      <>
        <ClaimOrgBanner
          orgId={orgId}
          userId={userId}
          isOrgClaimed={isOrgClaimed}
          isSignedIn={isSignedIn}
        />
        <ResetPasswordDialog />
        <div className="m-auto mt-10 flex w-full max-w-[700px] grow flex-col">
          <PlatformHeader
            orgName={orgName}
            isSignedIn={isSignedIn}
            isAdmin={isAdmin}
          />
          {children}
        </div>
      </>
    );
  }
}
