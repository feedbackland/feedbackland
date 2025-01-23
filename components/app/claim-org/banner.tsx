"use client";

import { ClaimOrgDialog } from "./dialog";

export function ClaimOrgBanner({ orgId }: { orgId: string }) {
  return (
    <div className=" flex items-center justify-between p-5 border-b border-border">
      <span>Claim this org</span>
      <ClaimOrgDialog
        orgId={orgId}
        onSuccess={() => {
          console.log("sucecssfully claimed!");
        }}
      />
    </div>
  );
}
