import "@iframe-resizer/child";
import { getSession } from "@/app/utils/server/helpers";
import { SignOutButton } from "./components/sign-out-button";
import { SignInDialog } from "./components/sign-in-dialog";
import { SignUpDialog } from "./components/sign-up-dialog";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-col space-y-3">
      <h1>Feedbackland WIP</h1>
      {session ? (
        <>
          <div>Session username: {session?.user?.name}</div>
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
