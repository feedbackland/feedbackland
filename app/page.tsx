import "@iframe-resizer/child";
import { getSession } from "@/app/utils/server/helpers";
import { SignOutButton } from "@/app/_components/sign-out/sign-out-button";
import { SignInDialog } from "@/app/_components/sign-in/sign-in-dialog";
import { Code } from "@/components/ui/code";

export default async function RootPage() {
  const session = await getSession();

  return (
    <div className="flex items-center space-x-5">
      <div>
        <Code code="`const numbers = [1, 2, 3]{:ts}`" />
      </div>
      {session ? <SignOutButton /> : <SignInDialog />}
    </div>
  );
}
