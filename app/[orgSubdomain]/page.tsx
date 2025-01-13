import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/app/utils/server/helpers";
import { SignOutButton } from "@/app/components/sign-out/sign-out-button";
import { SignInDialog } from "@/app/components/sign-in/sign-in-dialog";
import { SignUpDialog } from "@/app/components/sign-up/sign-up-dialog";
import { GetStartedWizard } from "@/app/components/get-started/get-started-wizard";
import { getOrg } from "@/app/queries";

export default async function OrgPage() {
  const subdomain = await getSubdomain();
  const session = await getSession();
  const org = await getOrg({ subdomain });
  const userId = session?.user?.id || null;

  return (
    <div className="flex flex-col space-y-3">
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
      {subdomain === "new" && <GetStartedWizard userId={userId} />}
    </div>
  );
}
