"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org-banner/actions";
import { ClaimOrgSuccess } from "@/components/app/claim-org-banner/success";

export function SSOListener({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [isOrgClaimed, setIsOrgClaimed] = useQueryState("org-claimed");

  const { executeAsync: claimOrg } = useAction(claimOrgAction, {
    onSuccess({ data }) {
      if (data?.success) {
        setIsOrgClaimed(null);
        setOpen(true);
      }
    },
  });

  useEffect(() => {
    if (orgId && userId && isOrgClaimed) {
      claimOrg({ orgId, userId });
    }
  }, [orgId, userId, isOrgClaimed, claimOrg]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ClaimOrgSuccess orgId={orgId} />
    </Dialog>
  );
}
