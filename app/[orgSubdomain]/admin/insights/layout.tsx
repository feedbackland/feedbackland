"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs-underlined";
import Link from "next/link";
import { ReactNode } from "react";

export default function AdminInsightsPage({
  children,
}: {
  children: ReactNode;
}) {
  const { isAdmin } = useAuth();
  const platformUrl = usePlatformUrl();
  const pathname = usePathname();
  const basePath = `${platformUrl}/admin/insights`;

  if (isAdmin) {
    return (
      <div className="-mt-2!">
        <Tabs className="" value={pathname?.split("/")?.pop() || "ai-roadmap"}>
          <TabsList className="">
            <TabsTrigger value="ai-roadmap" asChild>
              <Link href={`${basePath}/ai-roadmap`}>AI Roadmap</Link>
            </TabsTrigger>

            <TabsTrigger value="ai-explorer" asChild>
              <Link href={`${basePath}/ai-explorer`}>AI Explorer</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="pt-5">{children}</div>
      </div>
    );
  }
}
