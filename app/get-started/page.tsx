"use client";

import { CreateOrgCard } from "@/components/app/create-org/card";
import { FeedbacklandLogoFull } from "@/components/ui/logos";
import { navigateToSubdomain } from "@/lib/client/utils";

export default function GetStartedPage() {
  return (
    <div className="m-auto flex min-h-dvh w-dvw flex-col items-center bg-muted/50 pt-14">
      <FeedbacklandLogoFull className="mb-14 w-[165px]" />
      <CreateOrgCard
        onSuccess={({ orgSubdomain }) => navigateToSubdomain(orgSubdomain)}
      />
    </div>
  );
}
