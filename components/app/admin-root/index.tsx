"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useEffect, ReactNode } from "react";
import { SparklesIcon } from "lucide-react";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";

export default function AdminRoot({ children }: { children: ReactNode }) {
  const { isAdmin, isLoaded } = useAuth();
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const pathname = usePathname();
  const isSelfHosted = useIsSelfHosted();

  useEffect(() => {
    if (platformUrl && isLoaded && !isAdmin) {
      router.push(platformUrl);
    }
  }, [isLoaded, platformUrl, isAdmin, router]);

  if (isAdmin) {
    const adminBasePath = `${platformUrl}/admin`;

    return (
      <div>
        <Tabs
          className="relative h-10 w-full overflow-x-auto overflow-y-hidden"
          value={pathname?.split("/")?.pop() || "activity"}
        >
          <TabsList className="absolute flex h-10">
            <TabsTrigger value="insights" asChild>
              <Link href={`${adminBasePath}/insights`}>
                {/* <SparklesIcon fill="currentColor" className="size-3.5!" /> */}
                AI Insights
              </Link>
            </TabsTrigger>

            <TabsTrigger value="ask-ai" asChild>
              <Link href={`${adminBasePath}/ask-ai`}>
                {/* <SparklesIcon fill="currentColor" className="size-3.5!" /> */}
                Ask AI
              </Link>
            </TabsTrigger>

            <TabsTrigger value="activity" asChild>
              <Link href={`${adminBasePath}/activity`}>Activity</Link>
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

            {!isSelfHosted && (
              <TabsTrigger value="plan" asChild>
                <Link href={`${adminBasePath}/plan`}>Plan</Link>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <div className="mt-6">{children}</div>
      </div>
    );
  }

  return null;
}
