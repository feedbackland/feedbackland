import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/app/utils/server/helpers";
import { SignOutButton } from "./components/sign-out-button";
import { SignInDialog } from "./components/sign-in-dialog";
import { SignUpDialog } from "./components/sign-up-dialog";
import { GetStartedWizard } from "./components/get-started-wizard";

export default async function Home() {
  const session = await getSession();
  const subdomain = await getSubdomain();

  if (subdomain === "new") {
    return (
      <div>
        <h1>Get started</h1>
        <GetStartedWizard />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3">
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
    </div>
  );
}
