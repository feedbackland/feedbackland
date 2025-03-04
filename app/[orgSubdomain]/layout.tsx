import { getSession } from "@/lib/auth/session";
import { getOrgQuery } from "@/queries/get-org";
import { getIsAdminQuery } from "@/queries/get-is-admin";
import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const org = await getOrgQuery();
  const userId = session?.uid;
  const orgId = org?.id;
  const isOrgClaimed = !!org?.isClaimed;
  const isSignedIn = !!session;
  const isAdmin = !!(
    userId &&
    orgId &&
    (await getIsAdminQuery({ userId, orgId }))
  );

  if (org && orgId) {
    return (
      <>
        <ClaimOrgBanner
          orgId={orgId}
          isOrgClaimed={isOrgClaimed}
          isSignedIn={isSignedIn}
        />
        <div className="m-auto mt-10 flex w-full max-w-[700px] grow flex-col">
          <PlatformHeader isSignedIn={isSignedIn} isAdmin={isAdmin} />
          {children}
        </div>
      </>
    );
  }
}
