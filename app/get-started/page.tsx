"use client";

import { CreateOrgForm } from "@/components/app/create-org-form";
import { WidgetDocs } from "@/components/app/widget-docs";
import { Logo } from "@/components/ui/logo";
import { useState } from "react";

export default function RootPage() {
  const [org, setOrg] = useState<{
    orgId: string;
    orgSubdomain: string;
  } | null>(null);

  return (
    <div className="debug m-auto flex min-h-dvh w-dvw flex-col items-center bg-muted/50 pt-14">
      {/* <div className="mb-10 w-[35px]">
        <Logo variant="small" />
      </div> */}

      <div className="mb-10 w-[160px]">
        <Logo variant="full" />
      </div>

      <WidgetDocs org={{ orgId: "12444", orgSubdomain: "zolg" }} />

      {/* {!org ? (
        <CreateOrgForm
          onSuccess={({ orgId, orgSubdomain }) =>
            setOrg({ orgId, orgSubdomain })
          }
        />
      ) : (
        <WidgetDocs org={org} />
      )} */}
    </div>
  );
}
