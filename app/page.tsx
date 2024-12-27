import "@iframe-resizer/child";
import { getSession } from "@/app/utils/server/helpers";
import { SignOutButton } from "./components/sign-out-button";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-col space-y-3">
      <h1>Feedbackland</h1>
      {session && <div>Session username: {session?.user?.name}</div>}
      <SignOutButton />
    </div>
  );
}
