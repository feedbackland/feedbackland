import { getSession } from "@/lib/auth/session";
import { getOrg, getIsAdmin } from "@/lib/queries";
import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const org = await getOrg();
  const userId = session?.uid;
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
          isOrgClaimed={isOrgClaimed}
          isSignedIn={isSignedIn}
        />
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
