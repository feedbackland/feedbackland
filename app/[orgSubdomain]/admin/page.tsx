"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function AdminRedirectPage() {
  const { session, isLoaded } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const params = useParams();
  const orgSubdomain = params.orgSubdomain as string;

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      router.push(platformUrl);
    } else if (isLoaded && orgSubdomain && isAdmin) {
      router.replace(`/${orgSubdomain}/admin/activity`);
    }
  }, [isLoaded, platformUrl, isAdmin, router, orgSubdomain]);

  // Render null or a loading indicator while redirecting
  return null;
}
