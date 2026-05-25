"use client";

import { useMemo, useState } from "react";
import { FeedbackButton } from "feedbackland-react";
import { ExternalLink } from "lucide-react";
import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";
import { useVercelUrl } from "@/hooks/use-vercel-url";
import { buildPlaygroundSnippet, type Widget } from "@/lib/widget-snippets";

export function WidgetDocs({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  const isSelfHosted = useIsSelfHosted();
  const vercelUrl = useVercelUrl();

  const [widget, setWidget] = useState<Widget>("drawer");
  const [text, setText] = useState("Feedback");

  // Self-hosted instances need an explicit `url` so the widget knows
  // where to load the board iframe from.
  const url = useMemo(() => {
    if (!isSelfHosted || !vercelUrl) return undefined;
    return `${vercelUrl}/${orgSubdomain}`;
  }, [isSelfHosted, vercelUrl, orgSubdomain]);

  const snippet = useMemo(
    () =>
      buildPlaygroundSnippet({
        orgId,
        url,
        widget,
        text,
      }),
    [orgId, url, widget, text],
  );

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground max-w-prose text-sm">
        Drop a feedback button anywhere in your React or Next.js app.
      </p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Install</h3>
        <Code code="npm install feedbackland-react" lang="bash" />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Try it</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="widget-flavor">Flavor</Label>
            <Tabs value={widget} onValueChange={(v) => setWidget(v as Widget)}>
              <TabsList id="widget-flavor" className="grid w-full grid-cols-2">
                <TabsTrigger value="drawer">Drawer</TabsTrigger>
                <TabsTrigger value="popover">Popover</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-xs">
              {widget === "drawer"
                ? "Slide-in side panel with the full board."
                : "Anchored inline form; user stays in flow."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget-text">Button label</Label>
            <Input
              id="widget-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Feedback"
            />
          </div>
        </div>

        <div className="bg-muted/30 border-border flex min-h-[120px] items-center justify-center rounded-lg border px-4 py-8">
          <FeedbackButton
            platformId={orgId}
            url={url}
            widget={widget}
            text={text || "Feedback"}
          />
        </div>

        <Code code={snippet} lang="tsx" />
      </div>

      <p className="text-muted-foreground text-sm">
        For all styling options — Tailwind overrides, asChild, custom
        button, props reference — see the{" "}
        <a
          href="https://github.com/feedbackland/feedbackland-react#readme"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          README on GitHub
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
        .
      </p>
    </div>
  );
}
