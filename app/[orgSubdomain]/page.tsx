import { getSession, getSubdomain } from "@/lib/server/utils";
import { SignOutButton } from "@/components/app/sign-out";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
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
        <div className="m-auto mt-10 flex w-full max-w-[700px] flex-col space-y-3">
          {org && <h1>{org.name}&apos;s Feedback Platform!</h1>}
          <div className="flex items-center space-x-5">
            {session ? (
              <SignOutButton />
            ) : (
              <>
                <SignUpInDialog selectedMethod="sign-up" />
                <SignUpInDialog selectedMethod="sign-in" />
              </>
            )}
          </div>
        </div>
      </>
    );
  }
}
