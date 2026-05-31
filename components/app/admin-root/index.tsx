"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, ReactNode } from "react";

// Approximate widths of the 7 tab labels, for the auth-loading skeleton.
const TAB_WIDTHS = ["w-16", "w-20", "w-14", "w-16", "w-14", "w-14", "w-10"];

export default function AdminRoot({ children }: { children: ReactNode }) {
  const { isAdmin, isLoaded } = useAuth();
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (platformUrl && isLoaded && !isAdmin) {
      router.push(platformUrl);
    }
  }, [isLoaded, platformUrl, isAdmin, router]);

  const getValue = () => {
    return pathname?.split("/")?.pop() || "activity";
  };

  // While auth is still resolving, show the chrome's tab bar as a skeleton
  // (matching the real `h-9 rounded-lg bg-muted p-1` pill) instead of a blank
  // screen. Once resolved, either the real chrome (admin) or a redirect (not).
  if (!isLoaded) {
    return (
      <div>
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <div className="bg-muted inline-flex h-9 w-max items-center gap-1 rounded-lg p-1">
            {TAB_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={cn("h-7 rounded-md", w)} />
            ))}
          </div>
        </div>
        <div className="mt-6" />
      </div>
    );
  }

  if (isAdmin) {
    const adminBasePath = `${platformUrl}/admin`;

    return (
      <div>
        <Tabs
          value={getValue()}
          className="w-full overflow-x-auto overflow-y-hidden"
        >
          <TabsList className="w-max">
            <TabsTrigger value="activity" asChild>
              <Link href={`${adminBasePath}/activity`}>Activity</Link>
            </TabsTrigger>

            <TabsTrigger value="ai-roadmap" asChild>
              <Link href={`${adminBasePath}/ai-roadmap`}>AI Roadmap</Link>
            </TabsTrigger>

            <TabsTrigger value="ask-ai" asChild>
              <Link href={`${adminBasePath}/ask-ai`}>Ask AI</Link>
            </TabsTrigger>

            <TabsTrigger value="settings" asChild>
              <Link href={`${adminBasePath}/settings`}>Settings</Link>
            </TabsTrigger>

            <TabsTrigger value="admins" asChild>
              <Link href={`${adminBasePath}/admins`}>Admins</Link>
            </TabsTrigger>

            <TabsTrigger value="widget" asChild>
              <Link href={`${adminBasePath}/widget`}>Widget</Link>
            </TabsTrigger>

            <TabsTrigger value="api" asChild>
              <Link href={`${adminBasePath}/api`}>API</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-6">{children}</div>
      </div>
    );
  }

  return null;
}
