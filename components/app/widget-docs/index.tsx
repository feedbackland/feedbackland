"use client";

import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-underlined";
import { ArrowRight } from "lucide-react";
import { navigateToSubdomain } from "@/lib/client/utils";

export function WidgetDocs({
  org: { orgId, orgSubdomain },
}: {
  org: {
    orgId: string;
    orgSubdomain: string;
  };
}) {
  const overlayWidgetCode = `import { OverlayWidget } from "feedbackland/react";
  
  function App() {
    return <OverlayWidget id="${orgId}" />;
  }
  `;

  const inlineWidgetCode = `import { InlineWidget } from "feedbackland/react";
  
  function App() {
    return <InlineWidget id="${orgId}" />;
  }
  `;

  return (
    <div className="flex flex-col space-y-5">
      <Tabs defaultValue="overlay-react">
        <TabsList className="space-x-5">
          <TabsTrigger value="overlay-react" className="p-0 text-sm">
            Overlay widget (React)
          </TabsTrigger>
          <TabsTrigger value="inline-react" className="p-0 text-sm">
            Inline Widget (React)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overlay-react">
          <Code
            title="App.tsx"
            code={overlayWidgetCode}
            showLineNumbers={true}
            language="tsx"
          />
        </TabsContent>
        <TabsContent value="inline-react">
          <Code
            title="App.tsx"
            code={inlineWidgetCode}
            showLineNumbers={true}
            language="tsx"
          />
        </TabsContent>
      </Tabs>
      <Button onClick={() => navigateToSubdomain({ subdomain: orgSubdomain })}>
        <span>Proceed to your platfrom</span>
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
