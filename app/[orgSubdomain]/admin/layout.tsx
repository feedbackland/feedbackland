"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useEffect, useState, ReactNode } from "react";

export default function AdminTabLayout({ children }: { children: ReactNode }) {
  const { session, isLoaded } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const orgSubdomain = params.orgSubdomain as string;

  const [activeTab, setActiveTab] = useState("activity");

  useEffect(() => {
    if (isLoaded && platformUrl && session && !isAdmin) {
      // Redirect non-admins or users without org role away from admin pages
      router.push(platformUrl);
    }
  }, [isLoaded, platformUrl, session, isAdmin, router]);

  useEffect(() => {
    if (pathname && orgSubdomain) {
      const pathSegments = pathname.split("/");
      // Expected path: /<orgSubdomain>/admin/<tabName>
      // pathSegments: ["", "orgSubdomain", "admin", "tabName"]
      let currentSubPath = "activity"; // Default for /<orgSubdomain>/admin

      if (pathSegments.length > 3 && pathSegments[2] === "admin") {
        const tabName = pathSegments[3];

        if (["activity", "insights", "settings", "admins"].includes(tabName)) {
          currentSubPath = tabName;
        }
      }

      setActiveTab(currentSubPath);
    }
  }, [pathname, orgSubdomain]);

  if (!isLoaded) {
    return <div>Loading admin section...</div>; // Or a skeleton loader
  }

  if (!session || !isAdmin) {
    // If not loaded, or no session, or not admin, don't render admin content.
    // Redirection is handled by the useEffect above.
    return null;
  }

  const adminBasePath = `/${orgSubdomain}/admin`;

  return (
    <div>
      <Tabs value={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="activity" asChild>
            <Link href={`${adminBasePath}/activity`}>Activity</Link>
          </TabsTrigger>

          <TabsTrigger value="insights" asChild>
            <Link href={`${adminBasePath}/insights`}>Insights</Link>
          </TabsTrigger>

          <TabsTrigger value="settings" asChild>
            <Link href={`${adminBasePath}/settings`}>Settings</Link>
          </TabsTrigger>

          <TabsTrigger value="admins" asChild>
            <Link href={`${adminBasePath}/admins`}>Admins</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-4">{children}</div>
    </div>
  );
}
