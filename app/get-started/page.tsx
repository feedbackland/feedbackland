"use client";

import { CreateOrgCard } from "@/components/app/create-org/card";
import { FeedbacklandLogoFull } from "@/components/ui/logos";
import { navigateToSubdomain } from "@/lib/utils";

export default function GetStartedPage() {
  return (
    <div className="m-auto flex min-h-dvh w-dvw flex-col items-center pt-14">
      <FeedbacklandLogoFull className="fill-primary-foreground! mb-8 w-[165px]" />
      <CreateOrgCard
        onSuccess={({ orgSubdomain: subdomain }) => {
          navigateToSubdomain({ subdomain });
        }}
      />
    </div>
  );
}
