import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/app/utils/server/helpers";
import { SignOutButton } from "./components/sign-out-button";
import { SignInDialog } from "./components/sign-in-dialog";
import { SignUpDialog } from "./components/sign-up-dialog";
import { GetStartedWizard } from "./components/get-started-wizard";
import { getOrg } from "@/app/queries";

export default async function Home() {
  const subdomain = await getSubdomain();

  if (subdomain === "new") {
    return (
      <div>
        <h1>Get started</h1>
        <GetStartedWizard />
      </div>
    );
  }

  if (subdomain && subdomain.length > 0) {
    const session = await getSession();
    const org = await getOrg({ subdomain });

    if (org) {
      return (
        <div className="flex flex-col space-y-3">
          <h1>{org.name}&apos;s feedback platform</h1>
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
      );
    }
  }
}
