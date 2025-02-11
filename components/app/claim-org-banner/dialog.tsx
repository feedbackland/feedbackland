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
import { SignUpIn } from "@/components/app/sign-up-in";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "./actions";
import { ClaimOrgSuccess } from "./success";

export function ClaimOrgDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const { execute: claimOrg, isPending } = useAction(claimOrgAction, {
    onSuccess({ data }) {
      if (data?.success) {
        setSuccess(true);
      }
    },
  });

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
      {!success ? (
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="mb-3 mt-2">
            <DialogTitle className="h3 text-center">
              Claim this platform
            </DialogTitle>
            {/* <DialogDescription className="text-center">
            Sign up or in to claim ownership of this platform
          </DialogDescription> */}
          </DialogHeader>
          <SignUpIn
            context="claim-org"
            defaultSelectedMethod="sign-up"
            onSuccess={({ userId }) => {
              claimOrg({
                userId,
                orgId,
              });
            }}
          />
        </DialogContent>
      ) : (
        <ClaimOrgSuccess orgId={orgId} />
      )}
    </Dialog>
  );
}
