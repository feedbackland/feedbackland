import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/app/utils/server/helpers";
import { SignOutButton } from "./components/sign-out-button";
import { SignInDialog } from "./components/sign-in-dialog";
import { SignUpDialog } from "./components/sign-up-dialog";
// import { CreateOrgForm } from "./components/create-org-form";
import { GetStartedWizard } from "./components/get-started-wizard";

export default async function Home() {
  const subdomain = await getSubdomain();
  const session = await getSession();
  // const userId = session?.user?.id;
  // const userName = session?.user?.name;

  return (
    <div className="flex flex-col space-y-3">
      {subdomain && subdomain !== "new" && (
        <h1>{subdomain}&apos;s feedback platform</h1>
      )}
      {session ? (
        <div>
          <SignOutButton />
        </div>
      ) : (
        <div className="flex items-center space-x-5">
          <div>
            <SignInDialog />
          </div>
          <div>
            <SignUpDialog />
          </div>
        </div>
      )}
      {subdomain == "new" && (
        <div>
          <GetStartedWizard />
        </div>
      )}
    </div>
  );
}
