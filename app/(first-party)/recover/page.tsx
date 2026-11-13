import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";
import { RecoveryForm } from "./form";
export const metadata = {
  title: "Recover administrator access",
  robots: { index: false, follow: false },
};
export default function RecoverPage() {
  if (!getConfig().recoveryCode) notFound();
  return (
    <main className="mx-auto max-w-lg space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Recover administrator access</h1>
      <p>
        Use the recovery code from your hosting settings. Enter an existing
        administrator&apos;s password account. If this board has no
        administrators, an existing password account can be restored as its
        administrator.
      </p>
      <RecoveryForm />
      <p className="text-muted-foreground text-sm">
        If no password account exists, register an email/password account on
        this board first, then recover that address. Social-only accounts cannot
        be converted by recovery.
      </p>
    </main>
  );
}
