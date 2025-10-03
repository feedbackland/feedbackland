"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminRedirectPage() {
  const { isAdmin, isLoaded } = useAuth();
  const platformUrl = usePlatformUrl();
  const router = useRouter();

  useEffect(() => {
    if (platformUrl && isLoaded) {
      if (isAdmin) {
        router.replace(`${platformUrl}/admin/insights`);
      } else {
        router.push(platformUrl);
      }
    }
  }, [isLoaded, platformUrl, isAdmin, router]);

  return null;
}
