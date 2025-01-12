import "@iframe-resizer/child";
import { getHost, getSession } from "@/app/utils/server/helpers";
import { getSubdomain } from "@/app/utils/helpers";
import { SignOutButton } from "./components/sign-out/sign-out-button";
import { SignInDialog } from "./components/sign-in/sign-in-dialog";
import { SignUpDialog } from "./components/sign-up/sign-up-dialog";
import { GetStartedWizard } from "./components/get-started/get-started-wizard";
import { getOrg } from "@/app/queries";

export default async function Home() {
  const host = await getHost();
  const subdomain = getSubdomain({ host });
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
