"use client";

import { CreateTypes } from "canvas-confetti";
import { useState, useRef } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";

export function ClaimOrgBanner({
  orgId,
  isOrgClaimed,
}: {
  orgId: string | undefined;
  isOrgClaimed: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const instance = useRef<CreateTypes>(null);

  const onInitHandler = ({ confetti }: { confetti: CreateTypes }) =>
    (instance.current = confetti);

  const onShootHandler = () => {
    instance.current?.();
  };

  return (
    <>
      <ClaimOrgDialog
        open={isDialogOpen}
        initialSelectedStep="sign-up-in"
        orgId={orgId}
        onClose={() => setIsDialogOpen(false)}
      />

      <Confetti onInit={onInitHandler} />

      <Button onClick={onShootHandler}>Shoot</Button>

      {!isOrgClaimed && (
        <>
          <div className="flex items-center justify-center border-b border-border bg-primary px-4 py-2">
            <div className="flex w-full max-w-[700px] items-center justify-between">
              <span className="text-sm text-primary-foreground">
                This is a temporary, unclaimed platform. Claim it to make it
                yours!
              </span>
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="default"
                variant="outline"
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
