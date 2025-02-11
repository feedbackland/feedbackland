"use client";

import { CreateOrgForm } from "@/components/app/create-org-form";
import { WidgetDocsCard } from "@/components/app/widget-docs/card";
import { FeedbackLandLogoFull } from "@/components/ui/logos";
import { useState } from "react";

export default function RootPage() {
  const [org, setOrg] = useState<{
    orgId: string;
    orgSubdomain: string;
  } | null>(null);

  return (
    <div className="m-auto flex min-h-dvh w-dvw flex-col items-center bg-muted/50 pt-14">
      <FeedbackLandLogoFull className="mb-14 w-[165px]" />

      {!org ? (
        <CreateOrgForm
          onSuccess={({ orgId, orgSubdomain }) =>
            setOrg({ orgId, orgSubdomain })
          }
        />
      ) : (
        <WidgetDocsCard orgId={org?.orgId} orgSubdomain={org?.orgSubdomain} />
      )}
    </div>
  );
}
