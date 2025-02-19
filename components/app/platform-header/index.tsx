"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { SignOutButton } from "@/components/app/sign-out";
import { usePlatformUrl } from "@/hooks/usePlatformUrl";

export function PlatformHeader({
  orgName,
  isSignedIn,
  isAdmin,
}: {
  orgName: string;
  isSignedIn: boolean;
  isAdmin: boolean;
}) {
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const platformUrl = usePlatformUrl();

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
          <p className="text-sm text-muted-foreground">
            Powered by Feedbackland
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="link" size="default" asChild>
              <Link prefetch={false} href={`${platformUrl}/admin`}>
                <Shield className="size-4" />
                Admin panel
              </Link>
            </Button>
          )}
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
