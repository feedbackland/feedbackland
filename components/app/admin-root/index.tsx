"use client";

import { useAuth } from "@/hooks/use-auth";
import { useBoardHref } from "@/hooks/use-board-href";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, ReactNode } from "react";
import { useIsTopLevel } from "@/providers/surface";

// Approximate widths of the 7 tab labels, for the auth-loading skeleton.
const TABS = [
  "Activity",
  "Insights",
  "Ask AI",
  "Settings",
  "Admins",
  "Widget",
  "API",
];
const TAB_WIDTHS = TABS.map((label) => `${label.length * 0.45 + 1.5}rem`);

export default function AdminRoot({ children }: { children: ReactNode }) {
  const { isAdmin, isLoaded } = useAuth();
  const topLevel = useIsTopLevel();
  const href = useBoardHref();
  const boardRoot = href("/");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (topLevel && boardRoot && isLoaded && !isAdmin) {
      router.push(boardRoot);
    }
  }, [isLoaded, boardRoot, isAdmin, router, topLevel]);

  const getValue = () => {
    return pathname?.split("/")?.pop() || "activity";
  };

  // While auth is still resolving, show the chrome's tab bar as a skeleton
  // (matching the real `h-9 rounded-lg bg-muted p-1` pill) instead of a blank
  // screen. Once resolved, either the real chrome (admin) or a redirect (not).
  if (topLevel !== true)
    return <p role="alert">Open this page in its own tab.</p>;
  if (!isLoaded) {
    return (
      <div>
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <div className="bg-muted inline-flex h-9 w-max items-center gap-1 rounded-lg p-1">
            {TAB_WIDTHS.map((w, i) => (
              <Skeleton
                key={i}
                className={cn("h-7 rounded-md")}
                style={{ width: w }}
              />
            ))}
          </div>
        </div>
        <div className="mt-6" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div>
        <Tabs
          value={getValue()}
          className="w-full overflow-x-auto overflow-y-hidden"
        >
          <TabsList className="w-max">
            {TABS.map((label) => {
              const value = label.toLowerCase().replaceAll(" ", "-");
              return (
                <TabsTrigger key={value} value={value} asChild>
                  <Link href={href("/admin/" + value)}>{label}</Link>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <div className="mt-6">{children}</div>
      </div>
    );
  }

  return null;
}
