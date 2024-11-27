import { getUserByEmail } from "@/app/queries";
import { auth } from "@/app/utils/auth";
import { headers } from "next/headers";
import { SignUp } from "@/app/components/sign-up";
import { SignIn } from "@/app/components/sign-in";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  console.log("session", session);

  const user = await getUserByEmail("bleh@blah.com");

  return (
    <div className="flex flex-col space-y-3">
      <h1>Test6</h1>
      <div>{user?.name}</div>
      <div>{session && session?.user?.name}</div>
      <div className="flex space-x-5">
        <SignUp />
        <SignIn />
      </div>
    </div>
  );
}
