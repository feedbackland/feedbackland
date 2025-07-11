"use client";

import { Code } from "@/components/ui/code";
import { CodeInstall } from "@/components/ui/code-install";
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
      {showTitle && <h2 className="h4 mb-6">Widget</h2>}
      <div className="flex flex-col space-y-8">
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 1 - Install the package
          </h3>
          <CodeInstall packageName="feedbackland-react" />
        </div>
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 2 - Copy-paste in your app
          </h3>
          <Code
            code={overlayWidgetCodeSnippet}
            showLineNumbers={true}
            language="tsx"
            className=""
          />
        </div>
      </div>
    </div>
  );
}
