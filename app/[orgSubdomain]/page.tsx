import { getSession, getSubdomain } from "@/lib/server/utils";
import { getOrg } from "@/lib/queries";
import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";

export default async function OrgPage() {
  const subdomain = await getSubdomain();
  const session = await getSession();
  const org = await getOrg({ orgSubdomain: subdomain });
  const orgId = org?.id;
  const orgName = org?.name;
  const userId = session?.user?.id;
  const isOrgClaimed = !!org?.isClaimed;
  const isSignedIn = !!session;

  if (org && orgId) {
    return (
      <>
        <ClaimOrgBanner
          orgId={orgId}
          userId={userId}
          isOrgClaimed={isOrgClaimed}
        />
        <div className="m-auto mt-10 flex w-full max-w-[700px] flex-col space-y-3">
          <PlatformHeader orgName={orgName} isSignedIn={isSignedIn} />
        </div>
      </>
    );
  }
}
