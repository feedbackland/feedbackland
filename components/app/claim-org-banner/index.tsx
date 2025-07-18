"use client";

import { useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";

export function ClaimOrgBanner({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
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
            "bg-primary mb-6 flex w-full items-center justify-center rounded-lg px-3 py-2",
            hideBanner && "hidden",
            className,
          )}
        >
          <div
            className={cn(
              "flex w-full flex-1 items-center justify-between gap-2",
            )}
          >
            <div className="flex items-center gap-1.5">
              {/* <TriangleAlert className="size-5.5! shrink-0! text-yellow-500 dark:text-yellow-600" /> */}
              <span className="text-primary-foreground text-sm font-medium">
                Claim owernship of this platform and unlock admin access
              </span>
            </div>
            <Button
              onClick={handleOpenDialog}
              variant="secondary"
              size="sm"
              className="font-semibold capitalize"
            >
              Claim ownership
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
