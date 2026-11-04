import { PopupDone } from "./result";
export const metadata = {
  title: "Sign-in result",
  robots: { index: false, follow: false },
};
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <PopupDone
      ticket={
        typeof query.ticket === "string" && /^[a-f0-9]{32}$/.test(query.ticket)
          ? query.ticket
          : null
      }
      error={typeof query.error === "string" ? query.error : null}
    />
  );
}
