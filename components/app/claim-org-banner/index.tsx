"use client";

import { useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
// import { BadgeAlertIcon } from "lucide-react";
import { useInIframe } from "@/hooks/use-in-iframe";
import { BadgeAlertIcon } from "lucide-react";
import { isMobileOnly } from "react-device-detect";

export function ClaimOrgBanner({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
  const inIframe = useInIframe();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);
  const { signOut, session } = useAuth();
  const {
    query: { data: org },
  } = useOrg();
  const orgId = org?.id;
  const orgSubdomain = org?.orgSubdomain;
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
      {orgId && orgSubdomain && (
        <ClaimOrgDialog
          open={isDialogOpen}
          initialSelectedStep="sign-up-in"
          orgId={orgId}
          orgSubdomain={orgSubdomain}
          onClose={handleCloseDialog}
          onClaimed={onClaimed}
        />
      )}

      {isOrgClaimed === false && (
        <div
          className={cn(
            "flex w-full items-center justify-center bg-yellow-500/10 py-2.5",
            hideBanner && "hidden",
            className,
          )}
        >
          <div
            className={cn(
              "flex w-full flex-1 items-center justify-between gap-2",
              inIframe ? "px-4 sm:px-8" : "px-3 sm:max-w-2xl",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-black dark:text-yellow-500">
              <BadgeAlertIcon
                className={cn("size-5.5! shrink-0!", { hidden: isMobileOnly })}
              />
              <span className="">
                Claim ownership to generate your first AI Roadmap
              </span>
            </div>
            <Button
              onClick={handleOpenDialog}
              variant="default"
              size="sm"
              className="bg-yellow-500 text-black hover:bg-yellow-500/80"
            >
              Claim Ownership
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
