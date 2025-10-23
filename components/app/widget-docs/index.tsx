"use client";

import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { getOverlayWidgetCodeSnippet } from "@/lib/utils";

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
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col items-stretch">
          <Label className="text-muted-foreground mb-2">
            Install the package
          </Label>
          <Code code={`npm i feedbackland-react`} />
        </div>
        <div className="flex flex-col items-stretch">
          <Label className="text-muted-foreground mb-2">
            Add the feedback button anywhere in your app (e.g. in a menu or
            sidebar)
          </Label>
          <Code code={overlayWidgetCodeSnippet} />
        </div>
      </div>
    </div>
  );
}
