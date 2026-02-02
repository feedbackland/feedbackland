"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";
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
import { usePathname } from "next/navigation";
import { AccountSettings } from "@/components/app/account-settings";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInIframe } from "@/hooks/use-in-iframe";
import { ModeToggle } from "@/components/app/mode-toggle";

export function PlatformHeaderButtons() {
  const inIframe = useInIframe();
  const pathname = usePathname();
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const [isAccountSettingsDialogOpen, setIsAccountSettingsDialogOpen] =
    useState(false);
  const { session, signOut, isAdmin } = useAuth();
  const isAdminPage = pathname.includes("/admin");
  const platformUrl = usePlatformUrl();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <AccountSettings
        open={isAccountSettingsDialogOpen}
        onClose={() => setIsAccountSettingsDialogOpen(false)}
      />

      <SignUpInDialog
        open={isSignUpInDialogOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setIsSignUpInDialogOpen(false)}
      />

      <div className="flex items-center gap-1">
        {isAdmin && platformUrl && (
          <Link
            className="xs:block hidden"
            href={isAdminPage ? platformUrl : `${platformUrl}/admin`}
            target={inIframe ? "_blank" : "_self"}
          >
            <Button variant="ghost" size="sm">
              {isAdminPage ? (
                <HomeIcon className="size-3.5!" />
              ) : (
                <ShieldIcon className="size-3.5!" />
              )}
              {isAdminPage ? "Home" : "Admin Panel"}
            </Button>
          </Link>
        )}

        {!session && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground size-8!"
                onClick={() => setIsSignUpInDialogOpen(true)}
              >
                <LogInIcon className="size-4!" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign in</TooltipContent>
          </Tooltip>
        )}

        {session && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8! rounded-full"
                  >
                    <Avatar className="size-6!">
                      <AvatarImage
                        src={session?.user?.photoURL || undefined}
                        alt="User avatar image"
                      />
                      <AvatarFallback className="text-xs">
                        {session?.user?.name?.charAt(0) || (
                          <UserIcon className="size-3!" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Account</TooltipContent>
            </Tooltip>

            <DropdownMenuContent
              className="w-52 space-y-1"
              side="bottom"
              align="end"
            >
              <DropdownMenuItem
                className="flex flex-col items-stretch space-y-0"
                onClick={() => setIsAccountSettingsDialogOpen(true)}
              >
                <div className="flex items-center gap-1 font-semibold">
                  <span>{session?.user?.name || "Unnamed user"}</span>
                </div>
                {session?.user?.email && (
                  <div className="text-muted-foreground -mt-1 text-xs">
                    {session?.user?.email}
                  </div>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {session?.userOrg?.role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link
                    href={`${platformUrl}/admin`}
                    className="flex items-center gap-2"
                  >
                    <ShieldIcon className="size-3.5!" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="text-sm">
                <LogOutIcon className="size-3.5!" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ModeToggle />
      </div>
    </>
  );
}
