import "@iframe-resizer/child";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/app/utils/auth";
import { SignUp } from "@/app/components/sign-up";
import { SignIn } from "@/app/components/sign-in";

export default async function Home() {
  const headers = await nextHeaders();
  const subdomain = headers.get("x-subdomain");
  console.log("subdomain", subdomain);

  const session = await auth.api.getSession({
    headers,
  });

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
