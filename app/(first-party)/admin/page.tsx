"use client";

import { useAuth } from "@/hooks/use-auth";
import { useBoardHref } from "@/hooks/use-board-href";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminRedirectPage() {
  const { isAdmin, isLoaded } = useAuth();
  const href = useBoardHref();
  const boardRoot = href("/");
  const router = useRouter();

  useEffect(() => {
    if (boardRoot && isLoaded) {
      if (isAdmin) {
        router.replace(href(`/admin/activity`));
      } else {
        router.push(boardRoot);
      }
    }
  }, [isLoaded, boardRoot, isAdmin, router, href]);

  return null;
}
