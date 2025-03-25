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
import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { ModeToggle } from "@/components/app/mode-toggle";

export function PlatformHeader() {
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const { session, signOut } = useAuth();
  const platformUrl = usePlatformUrl();
  const isSignedIn = !!session;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="mb-5">
      <SignUpInDialog
        open={isSignUpInDialogOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setIsSignUpInDialogOpen(false)}
      />
      <div className="flex justify-between">
        <div className="flex flex-col">
          <h1 className="h3 font-extrabold">Feedback</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="default" asChild>
            <Link href={`${platformUrl}/admin`}>
              <span className="flex items-center gap-2">
                <Shield className="size-3.5!" />
                <span>Admin panel</span>
              </span>
            </Link>
          </Button>
          {/* {isAdmin && (
            <Button variant="link" size="default" asChild>
              <Link href={`${platformUrl}/admin`}>
                <Shield className="size-4" />
                Admin panel
              </Link>
            </Button>
          )} */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-32" side="bottom" align="end">
              {!isSignedIn ? (
                <DropdownMenuItem
                  onClick={() => setIsSignUpInDialogOpen(true)}
                  className="cursor-pointer"
                >
                  Sign in
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer"
                >
                  Sign out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ModeToggle />
        </div>
      </div>
      <p className="text-muted-foreground -mt-1 text-sm">
        Powered by Feedbackland
      </p>
    </div>
  );
}
