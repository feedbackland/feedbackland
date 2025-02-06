"use client";

import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { CodeInstall } from "@/components/ui/code-install";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-underlined";
import { ArrowRight } from "lucide-react";
import { navigateToSubdomain } from "@/lib/client/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
}`;

  const inlineWidgetCode = `import { InlineWidget } from "feedbackland/react";

function App() {
  return <InlineWidget id="${orgId}" />;
}`;

  return (
    <Card className="w-full max-w-[650px]">
      <CardHeader className="mb-2">
        <CardTitle className="h3 mb-3 mt-1 text-center font-bold">
          Add the widget to your app
        </CardTitle>
        <CardDescription className="text-center">
          Integrate your feedback platform directly into your app by installing
          a widget.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          <Button
            size="lg"
            onClick={() => navigateToSubdomain({ subdomain: orgSubdomain })}
          >
            <span>Proceed to your platform</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
