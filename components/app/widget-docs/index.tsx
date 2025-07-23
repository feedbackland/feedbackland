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
            Step 2 - Add this component to your app
          </h3>
          <Code
            code={overlayWidgetCodeSnippet}
            showLineNumbers={true}
            language="tsx"
            className="min-h-[225px]"
          />
        </div>
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 3 - Import and add{" "}
            <code className="bg-muted relative rounded px-[0.4rem] py-[0.2rem] font-mono text-sm">{`<FeedbackButton />`}</code>{" "}
            anywhere in your UI
          </h3>
        </div>
      </div>
    </div>
  );
}
