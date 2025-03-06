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
import { useAuth } from "@/hooks/useAuth";
import { useSubdomain } from "@/hooks/useSubdomain";
import { useMaindomain } from "@/hooks/useMaindomain";

export function PlatformHeader() {
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const subdomain = useSubdomain();
  const maindomain = useMaindomain();
  const platformUrl = usePlatformUrl();
  const { session } = useAuth();
  const isSignedIn = !!session;

  console.log("subdomain", subdomain);
  console.log("maindomain", maindomain);
  console.log("platformUrl", platformUrl);
  console.log("session", session);

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
        <div className="flex items-center">
          {/* {isAdmin && (
            <Button variant="link" size="default" asChild>
              <Link prefetch={false} href={`${platformUrl}/admin`}>
                <Shield className="size-4" />
                Admin panel
              </Link>
            </Button>
          )} */}
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
      <p className="-mt-1 text-sm text-muted-foreground">
        Powered by Feedbackland
      </p>
    </div>
  );
}
