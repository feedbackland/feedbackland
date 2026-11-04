import { ResetPasswordForm } from "./form";
export const metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <main className="mx-auto max-w-lg space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <ResetPasswordForm
        token={
          typeof query.token === "string" && query.token.length <= 512
            ? query.token
            : null
        }
        invalid={!!query.error}
      />
    </main>
  );
}
