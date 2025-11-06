"use client";

import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { getOverlayWidgetCodeSnippet } from "@/lib/utils";
import { FeedbackButton } from "feedbackland-react";

export function WidgetDocs({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  const overlayWidgetCodeSnippet = getOverlayWidgetCodeSnippet({
    orgId,
    orgSubdomain,
  });

  return (
    <div className="flex flex-col text-left">
      <div className="flex flex-col space-y-7">
        <div className="flex flex-col items-stretch gap-5">
          <div className="border-border relative flex h-32 w-full items-center justify-center rounded-lg border p-10">
            <Label className="text-muted-foreground absolute top-2 left-2.5 text-xs font-normal">
              PREVIEW
            </Label>
            <FeedbackButton platformId={orgId}>Feedback</FeedbackButton>
          </div>

          <Code code={`npm i feedbackland-react`} lang="bash" />

          <Code code={overlayWidgetCodeSnippet} lang="tsx" />
        </div>
      </div>
    </div>
  );
}
