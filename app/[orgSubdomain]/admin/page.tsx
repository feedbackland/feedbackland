"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminRedirectPage() {
  const { session, isLoaded } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const platformUrl = usePlatformUrl();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      if (isAdmin) {
        router.replace(`${platformUrl}/admin/activity`);
      } else {
        router.push(platformUrl);
      }
    }
  }, [isLoaded, platformUrl, isAdmin, router]);

  return null;
}
