"use client";

import { Code } from "@/components/ui/code";
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
      <div className="flex flex-col space-y-8">
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm font-medium">
            Install the package
          </h3>
          <Code code={`npm i feedbackland-react`} />
        </div>
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm font-medium">
            Add the feedback button anywhere in your app (for example, in a menu
            or sidebar)
          </h3>
          <Code code={overlayWidgetCodeSnippet} />
        </div>
      </div>
    </div>
  );
}
