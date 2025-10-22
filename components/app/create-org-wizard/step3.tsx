"use client";

import { Button } from "@/components/ui/button";
import { WidgetDocs } from "@/components/app/widget-docs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export function CreateOrgStep3({
  orgId,
  orgSubdomain,
  onSuccess,
}: {
  orgId: string;
  orgSubdomain: string;
  onSuccess: () => void;
}) {
  return (
    <Card className="w-full max-w-[650px]">
      <CardHeader>
        <CardTitle className="h3 mt-1 mb-3 text-center font-bold">
          Add the widget to your app
        </CardTitle>
      </CardHeader>
      <CardContent>
        <WidgetDocs
          orgId={orgId}
          orgSubdomain={orgSubdomain}
          showTitle={false}
        />
        <div className="mt-7">
          <Button onClick={() => onSuccess()} className="w-full">
            Proceed to your platform
            <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
