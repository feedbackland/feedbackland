"use client";

import { useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BadgeAlert } from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
import { useInIframe } from "@/hooks/use-in-iframe";

export function ClaimOrgBanner({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);
  const { signOut, session } = useAuth();
  const inIframe = useInIframe();
  const {
    query: { data: org },
  } = useOrg();
  const orgId = org?.id;
  const isOrgClaimed = org?.isClaimed;
  const isSignedIn = !!session;

  const handleOpenDialog = async () => {
    setIsDialogOpen(true);

    if (isSignedIn) {
      await signOut();
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const onClaimed = () => {
    setHideBanner(true);
    queryClient.invalidateQueries();
    confetti({
      particleCount: 100,
      spread: 700,
      origin: { y: 0.1 },
      scalar: 1.2,
      ticks: 150,
    });
  };

  return (
    <>
      <ClaimOrgDialog
        open={isDialogOpen}
        initialSelectedStep="sign-up-in"
        orgId={orgId || undefined}
        onClose={handleCloseDialog}
        onClaimed={onClaimed}
      />

      {isOrgClaimed === false && (
        <div
          className={cn(
            "bg-primary flex items-center justify-center py-1.5",
            hideBanner && "hidden",
            className,
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full max-w-[800px] items-center justify-between gap-2",
              inIframe ? "px-8" : "px-5",
            )}
          >
            <div className="flex items-center gap-1.5">
              <BadgeAlert className="size-5! shrink-0! fill-amber-500" />
              <span className="text-primary-foreground text-sm font-medium">
                Claim ownership now to unlock admin access and embed the widget
              </span>
            </div>
            <Button onClick={handleOpenDialog} variant="secondary" size="sm">
              Claim now
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
