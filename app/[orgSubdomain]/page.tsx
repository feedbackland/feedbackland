import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/lib/server/utils";
import { SignOutButton } from "@/components/app/sign-out/button";
import { SignInDialog } from "@/components/app/sign-in/dialog";
import { SignUpDialog } from "@/components/app/sign-up/dialog";
import { getOrg, isOrgClaimed } from "./queries";
import { ClaimOrgBanner } from "@/components/app/claim-org/banner";

export default async function OrgPage() {
  const subdomain = await getSubdomain();
  const session = await getSession();
  const org = await getOrg({ orgSubdomain: subdomain });

  if (org) {
    const isClaimed = await isOrgClaimed({ orgId: org.id });

    return (
      <>
        {!isClaimed && <ClaimOrgBanner orgId={org.id} />}
        <div className="mt-10 max-w-[600px] w-full m-auto flex flex-col space-y-3">
          {org && <h1>{org.name}&apos;s feedback platform</h1>}
          <div className="flex items-center space-x-5">
            {session ? (
              <SignOutButton />
            ) : (
              <>
                <SignInDialog />
                <SignUpDialog />
              </>
            )}
          </div>
        </div>
      </>
    );
  }
}
