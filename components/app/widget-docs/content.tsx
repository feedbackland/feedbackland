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
      <h3 className="text-muted-foreground text-sm font-medium">
        Adds a button to your app that slides in the platform as an overlay when
        clicked
      </h3>
      <div className="mt-6 flex flex-col space-y-6">
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 1 - Install the package
          </h3>
          <CodeInstall packageName="feedbackland/react" />
        </div>
        <div>
          <h3 className="text-primary mb-3 text-sm font-medium">
            Step 2 - Add the widget to your app
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
