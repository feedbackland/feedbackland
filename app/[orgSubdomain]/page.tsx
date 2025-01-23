import "@iframe-resizer/child";
import { getSession, getSubdomain } from "@/lib/server/helpers";
import { SignOutButton } from "@/components/app/sign-out/sign-out-button";
import { SignInDialog } from "@/components/app/sign-in/sign-in-dialog";
import { SignUpDialog } from "@/components/app/sign-up/sign-up-dialog";
import { GetStartedWizard } from "@/components/app/get-started/get-started-wizard";
import { db } from "@/db/db";

export default async function OrgPage() {
  const subdomain = await getSubdomain();
  const session = await getSession();
  const org = await db
    .selectFrom("org")
    .where("org.subdomain", "=", subdomain)
    .select("name")
    .executeTakeFirst();
  const userId = session?.user?.id || null;

  return (
    <div className="flex flex-col space-y-3">
      {org && <h1>{org.name}&apos;s feedback platform</h1>}
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
      {subdomain === "new" && <GetStartedWizard userId={userId} />}
    </div>
  );
}
