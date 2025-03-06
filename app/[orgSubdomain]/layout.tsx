import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ClaimOrgBanner />
      <div className="m-auto mt-10 flex w-full max-w-[700px] grow flex-col">
        <PlatformHeader />
        {children}
      </div>
    </>
  );
}
