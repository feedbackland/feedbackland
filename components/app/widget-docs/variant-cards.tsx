"use client";

import { FeedbackButton } from "feedbackland-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Code } from "@/components/ui/code";
import { buildVariantOnlySnippet } from "@/lib/widget-snippets";
import { PanelRight, MessageSquareText } from "lucide-react";

const variants = [
  {
    widget: "drawer" as const,
    label: "Drawer",
    badge: "default",
    icon: PanelRight,
    tagline: "Slide-in side panel with the full board.",
    description:
      "A focused, full-height panel that slides in from the right with a backdrop and focus trap. The user gets the entire feedback board — search, vote, comment, status — without leaving your app.",
    whenToUse: [
      "Feedback deserves a dedicated, focused experience",
      "You want users to browse + vote in addition to submitting",
      "A modal interaction model fits the moment",
    ],
  },
  {
    widget: "popover" as const,
    label: "Popover",
    badge: null,
    icon: MessageSquareText,
    tagline: "Inline popover, the user stays in flow.",
    description:
      "A compact form anchored directly to the button on desktop, or a bottom drawer on mobile. Submits a single piece of feedback via the public API without loading the full board.",
    whenToUse: [
      'Feedback is contextual ("Suggest an improvement to X")',
      "The user shouldn't be pulled out of what they're doing",
      "You want lightweight one-shot submissions",
    ],
  },
];

export function VariantCards({ orgId }: { orgId: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {variants.map((v) => (
        <Card key={v.widget} className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <v.icon className="text-muted-foreground size-4 shrink-0" />
                <CardTitle className="text-base">{v.label}</CardTitle>
                {v.badge && (
                  <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                    {v.badge}
                  </span>
                )}
              </div>
            </div>
            <CardDescription>{v.tagline}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {v.description}
            </p>

            <ul className="text-muted-foreground space-y-1.5 text-sm">
              <li className="text-foreground text-xs font-medium tracking-wide uppercase">
                Use when
              </li>
              {v.whenToUse.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="bg-muted/30 border-border flex items-center justify-center rounded-md border px-4 py-6">
              <FeedbackButton
                platformId={orgId}
                widget={v.widget}
                text={`Try the ${v.label.toLowerCase()}`}
                variant="outline"
              />
            </div>

            <Code
              code={buildVariantOnlySnippet(v.widget, orgId)}
              lang="tsx"
              className="text-xs"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
