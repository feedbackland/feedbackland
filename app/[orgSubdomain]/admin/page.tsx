"use client";

import { ActivityFeed } from "@/components/app/activity-feed";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter } from "next/navigation";

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
        <h1>Admin panel root page</h1>
        <ActivityFeed />
      </div>
    );
  }

  return null;
}
