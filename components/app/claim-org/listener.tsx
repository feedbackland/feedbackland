"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org/actions";
import { ClaimOrgDialog } from "@/components/app/claim-org/dialog";
import { triggers } from "@/lib/utils";

export function ClaimOrgListener({
  orgId,
  userId,
  isOrgClaimed,
  onClaimed,
}: {
  orgId: string | undefined;
  userId: string | undefined;
  isOrgClaimed: boolean;
  onClaimed?: () => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [trigger, setTrigger] = useQueryState(triggers.claimOrg);

  const { execute: claimOrg } = useAction(claimOrgAction, {
    onSuccess({ data }) {
      if (data?.success) {
        setTrigger(null);
        setIsDialogOpen(true);
        onClaimed?.();
      }
    },
  });

  useEffect(() => {
    if (orgId && userId && trigger) {
      if (!isOrgClaimed) {
        claimOrg({ orgId, userId });
      } else {
        setTrigger(null);
      }
    }
  }, [orgId, userId, trigger, isOrgClaimed, claimOrg, setTrigger]);

  return (
    <ClaimOrgDialog
      open={isDialogOpen}
      orgId={orgId}
      initialSelectedStep="success"
      onClose={() => setIsDialogOpen(false)}
    />
  );
}
