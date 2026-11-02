import { ReactNode } from "react";
import AdminRoot from "@/components/app/admin-root";
import PlatformRoot from "@/components/app/platform-root";
import { BoardState } from "@/components/app/board-state";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup-state";
import { getAuth, requireAdminSession } from "@/lib/auth/server";
import { EMBED_HEADER } from "@/lib/embed-surface";
import { DomainError } from "@/lib/domain-error";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isSetupComplete())) redirect("/setup");
  const requestHeaders = await headers();
  if (
    requestHeaders.get(EMBED_HEADER) !== "first-party" ||
    requestHeaders.get("sec-fetch-dest") === "iframe"
  )
    return <p role="alert">Open this page in its own tab.</p>;
  try {
    requireAdminSession(
      await getAuth().api.getSession({
        headers: requestHeaders,
        query: { disableRefresh: true },
      }),
    );
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return (
      <p role="alert">
        Sign in again with an administrator account to open this page.
      </p>
    );
  }
  return (
    <PlatformRoot>
      <BoardState />
      <AdminRoot>{children}</AdminRoot>
    </PlatformRoot>
  );
}
