"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignUpIn } from "@/components/app/sign-up-in";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org/actions";
import { WidgetDocsContent } from "../widget-docs/content";
import { cn } from "@/lib/utils";

export function ClaimOrgSignUpInDialog({ orgId }: { orgId: string }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const { executeAsync: claimOrg } = useAction(claimOrgAction);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) router.refresh();
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <Button
          onClick={() => setOpen(true)}
          size="default"
          variant="default"
          className="border !border-border bg-primary text-primary-foreground"
        >
          Claim this platform
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn("w-full max-w-[425px]", success && "max-w-[700px]")}
      >
        {!success ? (
          <>
            <DialogHeader className="mb-3 mt-2">
              <DialogTitle className="h3 text-center">
                Claim this platform
              </DialogTitle>
              <DialogDescription className="sr-only">
                Sign up or in to claim ownership of this platform
              </DialogDescription>
            </DialogHeader>
            <SignUpIn
              context="claim-org"
              defaultSelectedMethod="sign-up"
              onSuccess={async ({ userId }) => {
                await claimOrg({ orgId, userId });
                setSuccess(true);
              }}
            />
          </>
        ) : (
          <>
            <DialogHeader className="mb-3 mt-2">
              <DialogTitle className="h3 text-center">Congrats!</DialogTitle>
              <DialogDescription className="sr-only">
                You&apos;ve successfully claimed this platform!
              </DialogDescription>
            </DialogHeader>
            <WidgetDocsContent orgId={orgId} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
