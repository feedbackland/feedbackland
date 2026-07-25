"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlatformUrl } from "@/hooks/use-platform-url";

/**
 * The page moved to /admin/insights. This keeps existing bookmarks and links
 * working; it renders nothing and can be deleted once enough time has passed.
 */
export default function AIRoadmapRedirectPage() {
  const platformUrl = usePlatformUrl();
  const router = useRouter();

  useEffect(() => {
    if (platformUrl) {
      router.replace(`${platformUrl}/admin/insights`);
    }
  }, [platformUrl, router]);

  return null;
}
