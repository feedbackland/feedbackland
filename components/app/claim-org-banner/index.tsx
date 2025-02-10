"use client";

import { ClaimOrgDialog } from "./dialog";

export function ClaimOrgBanner({ orgId }: { orgId: string }) {
  return (
    <div className="flex items-center justify-center border-b border-border bg-primary px-4 py-2">
      <div className="flex w-full max-w-[700px] items-center justify-between">
        <span className="text-sm text-primary-foreground">
          This is a temporary unclaimed platform. Claim it to make it yours!
        </span>
        <ClaimOrgDialog
          orgId={orgId}
          onSuccess={() => {
            console.log("sucecssfully claimed!");
          }}
        />
      </div>
    </div>
  );
}
