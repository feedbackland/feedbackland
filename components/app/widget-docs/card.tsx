"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { navigateToSubdomain } from "@/lib/client/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WidgetDocsContent } from "./content";

export function WidgetDocsCard({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  return (
    <Card className="w-full max-w-[650px]">
      <CardHeader className="mb-2">
        <CardTitle className="h3 mb-3 mt-1 text-center font-bold">
          Add the widget to your app
        </CardTitle>
        <CardDescription className="text-center">
          Integrate your feedback platform directly into your app by installing
          a widget.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WidgetDocsContent orgId={orgId} />
        <Button size="lg" onClick={() => navigateToSubdomain(orgSubdomain)}>
          <span>Proceed to your platform</span>
          <ArrowRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
