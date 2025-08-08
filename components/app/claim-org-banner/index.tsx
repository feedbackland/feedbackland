"use client";

import { useEffect, useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { iframeParentAtom } from "@/lib/atoms";

export function ClaimOrgBanner({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);
  const { signOut, session } = useAuth();
  const iframeParent = useAtomValue(iframeParentAtom);
  const {
    query: { data: org },
  } = useOrg();
  const orgId = org?.id;
  const orgSubdomain = org?.orgSubdomain;
  const isOrgClaimed = org?.isClaimed;
  const isSignedIn = !!session;

  useEffect(() => {
    if (isOrgClaimed === undefined || iframeParent === null) return;
    iframeParent?.setIsClaimed(isOrgClaimed);
  }, [iframeParent, isOrgClaimed]);

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
            "flex w-full items-center justify-center bg-yellow-600 px-3 py-2.5",
            hideBanner && "hidden",
            className,
          )}
        >
          <div
            className={cn(
              "flex w-full max-w-[800px] flex-1 items-center justify-between gap-2 px-5",
            )}
          >
            <div className="flex items-center gap-2">
              {/* <TriangleAlert className="size-5! shrink-0! text-black" /> */}
              <span className="text-primary-foreground text-sm font-medium">
                Take ownership of this platform to unlock admin access
              </span>
            </div>
            <Button
              onClick={handleOpenDialog}
              variant="default"
              size="sm"
              className="bg-black font-semibold text-white hover:bg-black/85 hover:text-white"
            >
              Claim ownership
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
