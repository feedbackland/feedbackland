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
              Start collecting in-app feedback
            </CardTitle>
            <CardDescription className="text-primary mx-auto max-w-lg text-center">
              Add the feedback button to your React or Next.js app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WidgetDocs orgId={org.id} orgSubdomain={org.orgSubdomain} />
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
