"use client";

import { ActivityFeed } from "@/components/app/activity-feed";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Insights } from "@/components/app/insights";

export default function AdminPage() {
  const { session, isLoaded } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const platformUrl = usePlatformUrl();
  const router = useRouter();

  if (isLoaded && platformUrl && !isAdmin) {
    router.push(platformUrl);
  }

  if (isAdmin) {
    return (
      <div>
        <Tabs defaultValue="activity" className="">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="activity">
            <ActivityFeed />
          </TabsContent>
          <TabsContent value="insights">
            <Insights />
          </TabsContent>
          <TabsContent value="settings">Settings</TabsContent>
        </Tabs>
      </div>
    );
  }

  return null;
}
