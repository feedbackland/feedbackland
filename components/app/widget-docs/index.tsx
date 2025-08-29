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
      {showTitle && <h2 className="h5 mb-6">Widget</h2>}
      <div className="flex flex-col space-y-8">
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm font-medium">
            Install the package
          </h3>
          <CodeInstall packageName="feedbackland-react" />
        </div>
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm font-medium">
            Place the{" "}
            <code className="bg-muted text-primary relative rounded px-[0.4rem] py-[0.2rem] font-mono text-sm">{`FeedbackButton`}</code>{" "}
            anywhere in your React app (for example, in a menu or sidebar)
          </h3>
          <Code
            code={overlayWidgetCodeSnippet}
            showLineNumbers={true}
            language="tsx"
            className=""
          />
        </div>
        {/* <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 3 - Use{" "}
            <code className="bg-muted relative rounded px-[0.4rem] py-[0.2rem] font-mono text-sm">{`<FeedbackButton />`}</code>{" "}
            anywhere in your UI (e.g. inside of a sidebar or menu)
          </h3>
        </div> */}
      </div>
    </div>
  );
}
