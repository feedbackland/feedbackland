"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export function PlatformHeader() {
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const { session, signOut } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const platformUrl = usePlatformUrl();
  const { theme, setTheme } = useTheme();

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
          {isAdmin && (
            <Button variant="link" size="default" asChild>
              <Link href={`${platformUrl}/admin`}>
                <span className="flex items-center gap-2">
                  <Shield className="size-3.5!" />
                  <span>Admin panel</span>
                </span>
              </Link>
            </Button>
          )}
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="cursor-pointer">
                <Avatar className="">
                  <AvatarImage src={session?.user?.photoURL || undefined} />
                  <AvatarFallback>
                    {session?.user?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40" side="bottom" align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTheme((theme) => (theme === "light" ? "dark" : "light"));
                  }}
                  className="flex cursor-pointer items-center justify-between"
                >
                  <span>Dark mode</span>
                  <Switch checked={theme === "dark"} />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="cursor-pointer">
                <Button size="icon" variant="ghost" className="">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" side="bottom" align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTheme((theme) => (theme === "light" ? "dark" : "light"));
                  }}
                  className="flex cursor-pointer items-center justify-between"
                >
                  <span>Dark mode</span>
                  <Switch checked={theme === "dark"} />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsSignUpInDialogOpen(true)}
                  className="cursor-pointer"
                >
                  Sign in
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* <ModeToggle /> */}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Powered by{" "}
        <a
          href="https://feedbackland.com"
          target="_blank"
          className="hover:text-primary underline"
        >
          Feedbackland
        </a>
      </p>
    </div>
  );
}
