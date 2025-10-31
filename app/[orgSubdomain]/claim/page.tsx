"use client";

import { CreateOrgClaim } from "@/components/app/create-org-wizard/claim";
import { CreateOrgWidget } from "@/components/app/create-org-wizard/widget";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClaimPage() {
  const router = useRouter();
  const platformUrl = usePlatformUrl();
  const [isClaimed, setIsClaimed] = useState(false);

  if (!isClaimed) {
    return (
      <CreateOrgClaim
        onSuccess={() => {
          setIsClaimed(true);
        }}
      />
    );
  }

  if (isClaimed && platformUrl) {
    return (
      <CreateOrgWidget
        onSuccess={() => {
          router.push(platformUrl);
        }}
      />
    );
  }

  return null;
}
