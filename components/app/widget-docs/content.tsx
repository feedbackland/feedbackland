"use client";

import { Code } from "@/components/ui/code";
import { CodeInstall } from "@/components/ui/code-install";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-underlined";

export function WidgetDocsContent({ orgId }: { orgId: string }) {
  const overlayWidgetCode = `import { OverlayWidget } from "feedbackland/react";

function App() {
  return <OverlayWidget id="${orgId}" />;
}`;

  const inlineWidgetCode = `import { InlineWidget } from "feedbackland/react";

function App() {
  return <InlineWidget id="${orgId}" />;
}`;

  return (
    <div className="flex flex-col">
      <Tabs defaultValue="overlay" className="">
        <TabsList className="space-x-5">
          <TabsTrigger value="overlay" className="text-sm">
            Overlay widget
          </TabsTrigger>
          <TabsTrigger value="inline" className="text-sm">
            Inline Widget
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overlay" className="pt-2">
          <>
            <h3 className="text-sm font-medium text-muted-foreground">
              Adds a button to your app that slides in the platform as an
              overlay when clicked
            </h3>
            <div className="mt-6 flex flex-col space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium text-primary">
                  Step 1 - Install the feedbackland package
                </h3>
                <CodeInstall packageName="feedbackland/react" />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-primary">
                  Step 2 - Add the widget component to your app
                </h3>
                <Code
                  title="App.tsx"
                  code={overlayWidgetCode}
                  showLineNumbers={true}
                  language="tsx"
                  className="min-h-[148px]"
                />
              </div>
            </div>
          </>
        </TabsContent>
        <TabsContent value="inline">
          <div className="mt-5 flex flex-col space-y-3">
            <CodeInstall packageName="feedbackland/react" />
            <Code
              title="App.tsx"
              code={inlineWidgetCode}
              showLineNumbers={true}
              language="tsx"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
