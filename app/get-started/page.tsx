"use client";

import { CreateOrgForm } from "@/components/app/create-org-form";
import { WidgetDocs } from "@/components/app/widget-docs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";

export default function RootPage() {
  const [org, setOrg] = useState<{
    orgId: string;
    orgSubdomain: string;
  } | null>(null);

  return (
    <div className="m-auto mt-10 flex w-full max-w-[600px] flex-col space-y-5">
      <Card>
        {!org ? (
          <>
            <CardHeader>
              <CardTitle>Create your platform</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateOrgForm
                onSuccess={({ orgId, orgSubdomain }) =>
                  setOrg({ orgId, orgSubdomain })
                }
              />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Add the widget to your app</CardTitle>
            </CardHeader>
            <CardContent>
              <WidgetDocs org={org} />
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
