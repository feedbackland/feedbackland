"use client";

import { ClaimOrgSignUpInDialog } from "./sign-up-in-dialog";
import { ClaimOrgListener } from "./listener";

export function ClaimOrgBanner({
  orgId,
  userId,
  isOrgClaimed,
}: {
  orgId: string | undefined;
  userId: string | undefined;
  isOrgClaimed: boolean;
}) {
  if (orgId && !isOrgClaimed) {
    return (
      <>
        <ClaimOrgListener orgId={orgId} userId={userId} />
        <div className="flex items-center justify-center border-b border-border bg-primary px-4 py-2">
          <div className="flex w-full max-w-[700px] items-center justify-between">
            <span className="text-sm text-primary-foreground">
              This is a temporary unclaimed platform. Claim it to make it yours!
            </span>
            <ClaimOrgSignUpInDialog orgId={orgId} />
          </div>
        </div>
      </>
    );
  }

  return null;
}
