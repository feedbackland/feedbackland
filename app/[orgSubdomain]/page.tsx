import { getSession, getSubdomain } from "@/lib/server/utils";
import { SignOutButton } from "@/components/app/sign-out-button";
import { SignInDialog } from "@/components/app/sign-in-form/dialog";
import { SignUpDialog } from "@/components/app/sign-up-form/dialog";
import { getOrg } from "@/app/queries";
import { ClaimOrgBanner } from "@/components/app/claim-org-banner";

export default async function OrgPage() {
  const subdomain = await getSubdomain();
  const session = await getSession();
  const org = await getOrg({ orgSubdomain: subdomain });
  const isOrgClaimed = !!org?.isClaimed;

  if (org) {
    return (
      <>
        {!isOrgClaimed && <ClaimOrgBanner orgId={org.id} />}
        <div className="m-auto mt-10 flex w-full max-w-[600px] flex-col space-y-3">
          {org && <h1>{org.name}&apos;s Feedback Platform!</h1>}
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
