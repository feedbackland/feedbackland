import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { popupParameters } from "@/lib/auth/popup-parameters";
import { getSettings } from "@/lib/settings";
import { PopupConfirmation } from "./confirmation";

export const metadata = {
  title: "Confirm sign-in",
  robots: { index: false, follow: false },
};
export default async function PopupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = (await headers()).get("sec-fetch-site");
  // The proxy supplies 400 before streaming. This conservative fallback still
  // refuses confirmation when a deployment bypasses the proxy.
  if (site && site !== "same-origin") notFound();
  const parsed = popupParameters.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const settings = await getSettings();
  if (!settings.capabilities.socialProviders.includes(parsed.data.provider))
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <h1>Sign-in unavailable</h1>
        <p>
          This sign-in provider is unavailable. Close this tab and choose
          another method.
        </p>
      </main>
    );
  return <PopupConfirmation {...parsed.data} title={settings.platformTitle} />;
}
