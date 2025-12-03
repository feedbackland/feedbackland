"use client";

import { Code } from "@/components/ui/code";
import { Info } from "@/components/ui/info";
import { Label } from "@/components/ui/label";
import { getOverlayWidgetCodeSnippet } from "@/lib/utils";
import { FeedbackButton } from "feedbackland-react";

export function WidgetDocs({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  const overlayWidgetCodeSnippet = getOverlayWidgetCodeSnippet({
    orgId,
    orgSubdomain,
  });

  return (
    <div className="flex flex-col text-left">
      <div className="flex flex-col space-y-7">
        <div className="flex flex-col items-stretch gap-5">
          <div className="border-border bg-background relative flex h-32 w-full items-center justify-center rounded-lg border p-10 shadow-xs">
            <Label className="text-muted-foreground absolute top-2 left-2.5 text-xs font-normal">
              PREVIEW
            </Label>
            <FeedbackButton
              buttonElement={
                <button className="font-sans [all:revert]">Feedback</button>
              }
              platformId={orgId}
            />
          </div>

          {/* <Info
            description={
              <span className="text-primary flex flex-wrap gap-1">
                <span>
                  The button uses shadcn. For more info on how to customize it,
                  please visit the
                </span>
                <a
                  href="https://ui.shadcn.com/docs/components/button"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:underline"
                >
                  shadcn docs
                </a>
              </span>
            }
          /> */}

          <Code code={`npm i feedbackland-react`} lang="bash" />

          <Code code={overlayWidgetCodeSnippet} lang="tsx" />
        </div>
      </div>
    </div>
  );
}
