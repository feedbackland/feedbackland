"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Code } from "@/components/ui/code";
import { buildExample, type StylePattern } from "@/lib/widget-snippets";

const patterns: Array<{
  value: StylePattern;
  label: string;
  headline: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Default",
    headline: "Drop-in with sensible defaults",
    description:
      "The fastest path. Ships with a styled button that matches a modern shadcn-style aesthetic. Use the variant and size props for common tweaks; no className needed.",
  },
  {
    value: "className",
    label: "Tailwind override",
    headline: "Override with Tailwind classes",
    description:
      "Pass your own className. tailwind-merge resolves conflicts cleanly — your bg-*, rounded-*, padding, hover, focus, etc. win against the widget's defaults. Anything you don't override keeps the built-in baseline.",
  },
  {
    value: "unstyled",
    label: "Unstyled",
    headline: "Style from scratch",
    description:
      "variant=\"unstyled\" renders the widget's <button> element without any internal classes. The widget's typographic scope is also dropped, so the button inherits the host page's font and box-model. Pair with className for a fully custom look.",
  },
  {
    value: "asChild",
    label: "asChild",
    headline: "Bring your own button",
    description:
      "asChild merges the open handler into whatever element you pass — your own Button component, a Link, anything. The widget's styling is bypassed entirely. Same pattern as Radix UI.",
  },
];

export function StylingPatterns({ orgId }: { orgId: string }) {
  const [active, setActive] = useState<StylePattern>("default");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Style it your way</CardTitle>
        <CardDescription>
          Four progressively more flexible ways to customize the trigger
          button.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={active}
          onValueChange={(v) => setActive(v as StylePattern)}
        >
          <TabsList className="w-full overflow-x-auto">
            {patterns.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {patterns.map((p) => (
            <TabsContent key={p.value} value={p.value} className="mt-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold tracking-tight">
                  {p.headline}
                </h4>
                <p className="text-muted-foreground mt-1 max-w-prose text-sm leading-relaxed">
                  {p.description}
                </p>
              </div>
              <Code code={buildExample(p.value, orgId)} lang="tsx" />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
