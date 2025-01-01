import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/app/utils/server/helpers";
import { getUserWithOrgAndRole } from "@/app/queries";
import { SignOutButton } from "./components/sign-out-button";
import { SignInDialog } from "./components/sign-in-dialog";
import { SignUpDialog } from "./components/sign-up-dialog";
import { CreateOrgForm } from "./components/create-org-form";

export default async function Home() {
  const session = await getSession();
  const subdomain = await getSubdomain();
  const user = session?.user?.id
    ? await getUserWithOrgAndRole({ userId: session.user.id })
    : null;
  console.log("user", user);

  return (
    <div className="flex flex-col space-y-3">
      <h1>Feedbackland WIP</h1>
      {session ? (
        <>
          <div>Session username: {session?.user?.name}</div>
          {subdomain === "new" && (
            <div>
              <CreateOrgForm />
            </div>
          )}
          <div>
            <SignOutButton />
          </div>
        </>
      ) : (
        <>
          <div>
            <SignInDialog />
          </div>
          <div>
            <SignUpDialog />
          </div>
        </>
      )}
    </div>
  );
}
