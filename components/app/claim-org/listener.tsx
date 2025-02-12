"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org/actions";
import { ClaimOrgDialog } from "@/components/app/claim-org/dialog";

export function ClaimOrgListener({
  orgId,
  userId,
  isOrgClaimed,
}: {
  orgId: string | undefined;
  userId: string | undefined;
  isOrgClaimed: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trigger, setTrigger] = useQueryState("claim-org");

  const { execute: claimOrg } = useAction(claimOrgAction, {
    onSuccess({ data }) {
      if (data?.success) {
        setTrigger(null);
        setIsDialogOpen(true);
      }
    },
  });

  useEffect(() => {
    if (orgId && userId && trigger && !isOrgClaimed) {
      claimOrg({ orgId, userId });
    }
  }, [orgId, userId, trigger, isOrgClaimed, claimOrg]);

  return (
    <ClaimOrgDialog
      open={isDialogOpen}
      orgId={orgId}
      initialSelectedStep="success"
      onClose={() => setIsDialogOpen(false)}
    />
  );
}
