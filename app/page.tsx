<<<<<<< HEAD
import { getSubdomain, getSession } from "@/app/utils/helpers";
=======
import "@iframe-resizer/child";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/app/utils/auth";
>>>>>>> 09084e1f14898889076c39801f1594018fbbe121
import { SignUp } from "@/app/components/sign-up";
import { SignIn } from "@/app/components/sign-in";

export default async function Home() {
  const subdomain = await getSubdomain();
  const session = await getSession();

  console.log("subdomain", subdomain);
  console.log("session", session);

  return (
    <div className="flex flex-col space-y-3">
      <h1>Feedbackland</h1>
      {session && <div>Session username: {session?.user?.name}</div>}
      <div className="flex space-x-5">
        <SignUp />
        <SignIn />
      </div>
    </div>
  );
}
