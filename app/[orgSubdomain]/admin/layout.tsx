"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useEffect, ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { session, isLoaded } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (platformUrl && isLoaded && !isAdmin) {
      router.push(platformUrl);
    }
  }, [isLoaded, platformUrl, isAdmin, router]);

  if (isAdmin) {
    const adminBasePath = `${platformUrl}/admin`;

    return (
      <div>
        <Tabs value={pathname?.split("/")?.pop() || "activity"}>
          <TabsList className="">
            <TabsTrigger value="activity" asChild>
              <Link href={`${adminBasePath}/activity`}>Activity</Link>
            </TabsTrigger>

            <TabsTrigger value="insights" asChild>
              <Link href={`${adminBasePath}/insights`}>AI Insights</Link>
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
          </TabsList>
        </Tabs>
        <div className="mt-4">{children}</div>
      </div>
    );
  }

  return null;
}
