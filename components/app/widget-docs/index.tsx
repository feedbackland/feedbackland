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
        {/* <div className="flex flex-col items-stretch">
          <Label className="text-muted-foreground mb-2.5">
            Install the package
          </Label>
          <Code code={`npm i feedbackland-react`} lang="bash" />
        </div> */}
        <div className="flex flex-col items-stretch gap-5">
          {/* <Label className="text-muted-foreground mb-2.5">
            Place the feedback button anywhere in your app, such as the navbar
            or sidebar
          </Label> */}

          <div className="border-border flex h-32 w-full items-center justify-center rounded-lg border p-10">
            <FeedbackButton platformId={orgId}>Feedback</FeedbackButton>
          </div>

          <Code code={`npm i feedbackland-react`} lang="bash" />

          <Code code={overlayWidgetCodeSnippet} lang="tsx" className="" />
        </div>
      </div>
    </div>
  );
}
