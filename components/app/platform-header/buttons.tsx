"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  MoonIcon,
  MoreHorizontalIcon,
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
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { usePathname } from "next/navigation";
import { AccountSettings } from "@/components/app/account-settings";
// import { useAtomValue } from "jotai";
// import { iframeParentAtom } from "@/lib/atoms";
// import { useInIframe } from "@/hooks/use-in-iframe";

export function PlatformHeaderButtons() {
  const pathname = usePathname();
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const [isAccountSettingsDialogOpen, setIsAccountSettingsDialogOpen] =
    useState(false);
  const { session, signOut, isAdmin } = useAuth();
  const isAdminPage = pathname.includes("/admin");
  const platformUrl = usePlatformUrl();
  const { theme, setTheme } = useTheme();
  // const iframeParent = useAtomValue(iframeParentAtom);
  // const inIframe = useInIframe();

  const handleSignOut = async () => {
    await signOut();
  };

  const openAccountSettings = () => {
    setIsAccountSettingsDialogOpen(true);
  };

  const closeAccountSettings = () => {
    setIsAccountSettingsDialogOpen(false);
  };

  return (
    <>
      <AccountSettings
        open={isAccountSettingsDialogOpen}
        onClose={closeAccountSettings}
      />

      <SignUpInDialog
        open={isSignUpInDialogOpen}
        initialSelectedMethod="sign-in"
        onClose={() => setIsSignUpInDialogOpen(false)}
      />

      <div className="flex items-center gap-3">
        {isAdmin && platformUrl && (
          <Button variant="ghost" size="default" asChild>
            <Link
              className="xs:block hidden"
              href={isAdminPage ? platformUrl : `${platformUrl}/admin`}
            >
              <span className="flex items-center gap-2">
                {isAdminPage ? (
                  <HomeIcon className="size-3.5!" />
                ) : (
                  <ShieldIcon className="size-3.5!" />
                )}
                <span>{isAdminPage ? "Home" : "Admin Panel"}</span>
              </span>
            </Link>
          </Button>
        )}

        <DropdownMenu>
          {session ? (
            <DropdownMenuTrigger asChild className="cursor-pointer">
              <Avatar className="-mr-0.5">
                <AvatarImage
                  src={session?.user?.photoURL || undefined}
                  alt="User avatar image"
                />
                <AvatarFallback>
                  {session?.user?.name?.charAt(0) || (
                    <UserIcon className="size-3.5!" />
                  )}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
          ) : (
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-7!">
                <MoreHorizontalIcon className="size-4!" />
                <span className="sr-only">Open options dropdown</span>
              </Button>
            </DropdownMenuTrigger>
          )}

          <DropdownMenuContent
            className="w-52 space-y-1"
            side="bottom"
            align="end"
          >
            {session && (
              <>
                <DropdownMenuItem
                  className="flex flex-col items-stretch space-y-0"
                  onClick={openAccountSettings}
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
              </>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newTheme = theme === "light" ? "dark" : "light";
                setTheme(newTheme);
              }}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm">
                <MoonIcon className="size-3.5!" />
                Dark mode
              </span>
              <Switch checked={theme === "dark"} />
            </DropdownMenuItem>
            {/* <DropdownMenuSeparator /> */}
            {session ? (
              <DropdownMenuItem onClick={handleSignOut} className="text-sm">
                <LogOutIcon className="size-3.5!" />
                Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setIsSignUpInDialogOpen(true)}>
                <LogInIcon className="size-3.5!" />
                Sign in
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* {inIframe && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7!"
            onClick={() => {
              iframeParent?.close();
            }}
          >
            <XIcon className="size-4!" />
          </Button>
        )} */}
      </div>
    </>
  );
}
