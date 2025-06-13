"use client";

import { Code } from "@/components/ui/code";
import { CodeInstall } from "@/components/ui/code-install";

export function WidgetDocsContent({ orgId }: { orgId: string }) {
  const overlayWidgetCode = `import { OverlayWidget } from "feedbackland/react";

function App() {
  return <OverlayWidget id="${orgId}" />;
}`;

  return (
    <div className="flex flex-col">
      <h2 className="h4 mb-6">Widget</h2>
      <div className="flex flex-col space-y-8">
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 1 - Install the package
          </h3>
          <CodeInstall packageName="feedbackland/react" />
        </div>
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 2 - Embed the widget
          </h3>
          <Code
            code={overlayWidgetCode}
            showLineNumbers={true}
            language="tsx"
            className=""
          />
        </div>
      </div>
    </div>
  );
}
