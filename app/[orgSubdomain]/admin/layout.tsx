import { getPlatformUrl } from "@/lib/server/utils";
import { getSession } from "@/lib/auth/session";
import { getOrgQuery } from "@/queries/get-org";
import { getIsAdminQuery } from "@/queries/get-is-admin";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const userId = session?.uid;
  const org = await getOrgQuery();
  const orgId = org?.id;
  const isAdmin = !!(
    userId &&
    orgId &&
    (await getIsAdminQuery({ userId, orgId }))
  );

  if (isAdmin) {
    return <div>{children}</div>;
  } else {
    const platformUrl = await getPlatformUrl();
    redirect(platformUrl);
  }
}
