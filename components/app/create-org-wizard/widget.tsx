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
import { CreateOrgWrapper } from "./wrapper";
import { useOrg } from "@/hooks/use-org";

export function CreateOrgWidget({ onSuccess }: { onSuccess: () => void }) {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org?.id && org?.orgSubdomain) {
    return (
      <CreateOrgWrapper>
        <Card className="w-full max-w-[750px]">
          <CardHeader>
            <CardTitle className="h3 mt-1 mb-3 text-center font-bold">
              Add the widget to your app
            </CardTitle>
            <CardDescription className="text-primary mx-auto max-w-lg text-center">
              Your feedback platform is ready. Follow the steps below to embed
              it in your React or Next.js app now, or feel free to do this
              later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WidgetDocs
              orgId={org.id}
              orgSubdomain={org.orgSubdomain}
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
      </CreateOrgWrapper>
    );
  }
}
