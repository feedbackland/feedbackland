import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup-state";
import { SetupForm } from "./form";
export const metadata = {
  title: "Set up your feedback board",
  robots: { index: false, follow: false },
};
export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/");
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Set up your feedback board</h1>
      <p>
        Use the setup code from your hosting settings or private startup log to
        create the first administrator.
      </p>
      <SetupForm />
    </main>
  );
}
