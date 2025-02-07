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
import { SignUp } from "@/components/app/sign-up";
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
        <Button
          onClick={() => setOpen(true)}
          loading={isPending}
          size="default"
          variant="default"
          className="border !border-border bg-primary text-primary-foreground"
        >
          Claim this platform
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="h3 mb-4 mt-2 text-center">
            Claim this platform
          </DialogTitle>
        </DialogHeader>
        <SignUp
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
