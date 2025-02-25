import { getPlatformUrl, getSession } from "@/lib/server/utils";
import { getOrg, getIsAdmin } from "@/lib/queries";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const userId = session?.user?.id;
  const org = await getOrg();
  const orgId = org?.id;
  const isAdmin = !!(userId && orgId && (await getIsAdmin({ userId, orgId })));

  if (isAdmin) {
    return <div>{children}</div>;
  } else {
    const platformUrl = await getPlatformUrl();
    redirect(platformUrl);
  }
}
