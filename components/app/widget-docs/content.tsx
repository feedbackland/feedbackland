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
      <Tabs defaultValue="overlay-react" className="mb-7">
        <TabsList className="space-x-5">
          <TabsTrigger value="overlay-react" className="text-sm">
            Overlay widget - React
          </TabsTrigger>
          <TabsTrigger value="inline-react" className="text-sm">
            Inline Widget - React
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overlay-react">
          <div className="mt-5 flex flex-col space-y-3">
            <CodeInstall packageName="feedbackland/react" />
            <Code
              title="App.tsx"
              code={overlayWidgetCode}
              showLineNumbers={true}
              language="tsx"
            />
          </div>
        </TabsContent>
        <TabsContent value="inline-react">
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
