"use client";

import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { getOverlayWidgetCodeSnippet } from "@/lib/utils";
import { FeedbackButton } from "feedbackland-react";

export function WidgetDocs({
  orgId,
  orgSubdomain,
  showTitle = true,
}: {
  orgId: string;
  orgSubdomain: string;
  showTitle?: boolean;
}) {
  const overlayWidgetCodeSnippet = getOverlayWidgetCodeSnippet({
    orgId,
    orgSubdomain,
  });

  return (
    <div className="flex flex-col text-left">
      {showTitle && <h2 className="h5 mb-6">Widget</h2>}
      <div className="flex flex-col space-y-7">
        <div className="flex flex-col items-stretch">
          <Label className="text-muted-foreground mb-2.5">
            Install the package
          </Label>
          <Code code={`npm i feedbackland-react`} lang="bash" />
        </div>
        <div className="flex flex-col items-stretch">
          <Label className="text-muted-foreground mb-2.5">
            Place the feedback button anywhere in your app, such as the navbar
            or sidebar
          </Label>

          <div className="border-border flex h-32 w-full items-center justify-center rounded-t-lg border border-b-0 p-10">
            <FeedbackButton platformId={orgId} />
          </div>

          <Code
            code={overlayWidgetCodeSnippet}
            lang="tsx"
            className="rounded-t-none"
          />
        </div>
      </div>
    </div>
  );
}
