"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SignUpForm } from "@/components/app/sign-up-form";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "./actions";
import { useRouter } from "next/navigation";

export function ClaimOrgDialog({
  orgId,
  onSuccess,
}: {
  orgId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);

  const router = useRouter();

  const { executeAsync: claimOrg, isPending } = useAction(claimOrgAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} loading={isPending}>
          Claim this platform
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Claim this platform</DialogTitle>
        </DialogHeader>
        <SignUpForm
          onSuccess={async ({ userId }) => {
            const response = await claimOrg({
              userId,
              orgId,
            });

            if (response?.data?.success) {
              router.refresh();
              setOpen(false);
              onSuccess();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
