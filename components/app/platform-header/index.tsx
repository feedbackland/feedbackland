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
import { useOrg } from "@/hooks/use-org";

export function PlatformHeader() {
  const pathname = usePathname();
  const [isSignUpInDialogOpen, setIsSignUpInDialogOpen] = useState(false);
  const { session, signOut } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const isAdminPage = pathname.includes("/admin");
  const platformUrl = usePlatformUrl();
  const { theme, setTheme } = useTheme();
  const {
    query: { data: orgData },
  } = useOrg();

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
          <h1 className="h3 font-extrabold">
            <Link href={`${platformUrl}`}>
              {orgData?.platformTitle || "Feedback"}
            </Link>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button variant="ghost" size="default" asChild>
              <Link href={isAdminPage ? platformUrl : `${platformUrl}/admin`}>
                <span className="flex items-center gap-2">
                  {isAdminPage ? (
                    <HomeIcon className="size-3.5!" />
                  ) : (
                    <ShieldIcon className="size-3.5!" />
                  )}
                  <span>{isAdminPage ? "Home" : "Admin panel"}</span>
                </span>
              </Link>
            </Button>
          )}

          <DropdownMenu>
            {session ? (
              <DropdownMenuTrigger asChild className="cursor-pointer">
                <Avatar className="">
                  <AvatarImage src={session?.user?.photoURL || undefined} />
                  <AvatarFallback>
                    {session?.user?.name?.charAt(0) || (
                      <UserIcon className="size-3.5!" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
            ) : (
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="">
                  <MoreHorizontalIcon className="size-3.5!" />
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
                  <DropdownMenuItem className="flex flex-col items-stretch space-y-0">
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
                        Admin panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTheme((theme) => (theme === "light" ? "dark" : "light"));
                }}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-sm">
                  <MoonIcon className="size-3.5!" />
                  Dark mode
                </span>
                <Switch checked={theme === "dark"} />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
        </div>
      </div>

      {orgData?.platformDescription &&
        orgData?.platformDescription?.length > 0 && (
          <div className="text-muted-foreground text-sm font-normal">
            {orgData.platformDescription}
          </div>
        )}
    </div>
  );
}
