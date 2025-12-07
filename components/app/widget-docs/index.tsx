"use client";

import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { getOverlayWidgetCodeSnippet } from "@/lib/utils";
import { FeedbackButton } from "feedbackland-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs-underlined";

export function WidgetDocs({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  return (
    <Tabs defaultValue="drawer">
      <TabsList>
        <TabsTrigger value="drawer">Drawer</TabsTrigger>

        <TabsTrigger value="popover">Popover</TabsTrigger>
      </TabsList>

      <TabsContent value="drawer">
        <div className="flex flex-col text-left">
          <div className="flex flex-col space-y-7">
            <div className="flex flex-col items-stretch gap-5">
              <div className="border-border bg-background relative flex h-32 w-full items-center justify-center rounded-lg border p-10 shadow-xs">
                <Label className="text-muted-foreground absolute top-2 left-2.5 text-xs font-normal">
                  PREVIEW
                </Label>
                <FeedbackButton
                  buttonElement={<Button>Feedback</Button>}
                  platformId={orgId}
                  widget="drawer"
                />
              </div>

              <Code code={`npm i feedbackland-react`} lang="bash" />

              <Code
                code={getOverlayWidgetCodeSnippet({
                  orgId,
                  orgSubdomain,
                  type: "drawer",
                })}
                lang="tsx"
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="popover">
        <div className="flex flex-col text-left">
          <div className="flex flex-col space-y-7">
            <div className="flex flex-col items-stretch gap-5">
              <div className="border-border bg-background relative flex h-32 w-full items-center justify-center rounded-lg border p-10 shadow-xs">
                <Label className="text-muted-foreground absolute top-2 left-2.5 text-xs font-normal">
                  PREVIEW
                </Label>
                <FeedbackButton
                  buttonElement={<Button>Feedback</Button>}
                  platformId={orgId}
                  widget="popover"
                />
              </div>

              <Code code={`npm i feedbackland-react`} lang="bash" />

              <Code
                code={getOverlayWidgetCodeSnippet({
                  orgId,
                  orgSubdomain,
                  type: "popover",
                })}
                lang="tsx"
              />
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
