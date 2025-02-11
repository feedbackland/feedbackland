"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org/actions";
import { ClaimOrgSuccessDialog } from "@/components/app/claim-org/success-dialog";

export function ClaimOrgListener({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useQueryState("claim-org");

  const { execute: claimOrg } = useAction(claimOrgAction, {
    onSuccess({ data }) {
      if (data?.success) {
        setTrigger(null);
        setOpen(true);
      }
    },
  });

  useEffect(() => {
    if (orgId && userId && trigger) {
      claimOrg({ orgId, userId });
    }
  }, [orgId, userId, trigger, claimOrg]);

  return (
    <ClaimOrgSuccessDialog
      open={open}
      orgId={orgId}
      onClose={() => setOpen(false)}
    />
  );
}
