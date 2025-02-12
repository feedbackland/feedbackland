"use client";

import { useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";

export function ClaimOrgBanner({
  orgId,
  isOrgClaimed,
}: {
  orgId: string | undefined;
  isOrgClaimed: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <ClaimOrgDialog
        open={isDialogOpen}
        initialSelectedStep="sign-up-in"
        orgId={orgId}
        onClose={() => setIsDialogOpen(false)}
      />

      {isOrgClaimed && (
        <>
          <div className="flex items-center justify-center border-b border-border bg-primary px-4 py-2">
            <div className="flex w-full max-w-[700px] items-center justify-between">
              <span className="text-sm text-primary-foreground">
                This is a temporary, unclaimed platform. Claim it to make it
                yours!
              </span>
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="sm"
                variant="default"
              >
                Claim this platform
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
