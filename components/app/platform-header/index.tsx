"use client";

import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { SignOutButton } from "@/components/app/sign-out";

export function PlatformHeader({
  orgName,
  isSignedIn,
}: {
  orgName?: string;
  isSignedIn: boolean;
}) {
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);

  return (
    <>
      <SignUpInDialog
        open={isSignUpInDialogOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setIsSignUpInDialogOpen(false)}
      />
      <div className="flex justify-between">
        <div className="flex flex-col">
          <h1 className="h3">{orgName}&apos;s Feedback Platform!</h1>
          <p>Powered by Feedbackland</p>
        </div>
        <div>
          {!isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-32" side="bottom" align="end">
                <DropdownMenuItem
                  onClick={() => setIsSignUpInDialogOpen(true)}
                  className="cursor-pointer"
                >
                  Sign in
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <SignOutButton />
          )}
        </div>
      </div>
    </>
  );
}
