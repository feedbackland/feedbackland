"use client";

import { Button } from "@/components/ui/button";
import { WidgetDocs } from "@/components/app/widget-docs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <CardDescription className="text-primary mx-auto max-w-lg text-center">
          Your feedback platform is ready! Follow the steps below to embed it in
          your React or Next.js app, or feel free to do this later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WidgetDocs
          orgId={orgId}
          orgSubdomain={orgSubdomain}
          showTitle={false}
        />
        <div className="mt-9">
          <Button onClick={() => onSuccess()} className="w-full">
            Proceed to your platform
            <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
