"use client";

import { useMemo, useState } from "react";
import { FeedbackButton } from "feedbackland-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Code } from "@/components/ui/code";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";
import { useVercelUrl } from "@/hooks/use-vercel-url";
import {
  buildPlaygroundSnippet,
  type Variant,
  type Size,
  type Widget,
} from "@/lib/widget-snippets";

const VARIANT_OPTIONS: { value: Variant; label: string; hint?: string }[] = [
  { value: "default", label: "Default" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
  { value: "ghost", label: "Ghost" },
  { value: "link", label: "Link" },
  { value: "destructive", label: "Destructive" },
  {
    value: "unstyled",
    label: "Unstyled",
    hint: "no internal classes — style with className",
  },
];

const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "sm", label: "Small" },
  { value: "lg", label: "Large" },
];

export function Playground({
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
  const [variant, setVariant] = useState<Variant>("default");
  const [size, setSize] = useState<Size>("default");
  const [className, setClassName] = useState("");

  // Self-hosted instances need an explicit `url` so the widget knows where
  // to load the board iframe from (and where to POST popover submissions).
  const url = useMemo(() => {
    if (!isSelfHosted) return undefined;
    if (!vercelUrl) return undefined;
    return `${vercelUrl}/${orgSubdomain}`;
  }, [isSelfHosted, vercelUrl, orgSubdomain]);

  const snippet = useMemo(
    () =>
      buildPlaygroundSnippet({
        orgId,
        url,
        widget,
        text,
        variant,
        size,
        className,
      }),
    [orgId, url, widget, text, variant, size, className],
  );

  const selectedVariant = VARIANT_OPTIONS.find((o) => o.value === variant);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customize</CardTitle>
        <CardDescription>
          Tweak the trigger button, see the live result, copy the snippet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="widget-playground-widget">Widget</Label>
              <Tabs
                value={widget}
                onValueChange={(v) => setWidget(v as Widget)}
              >
                <TabsList
                  id="widget-playground-widget"
                  className="grid w-full grid-cols-2"
                >
                  <TabsTrigger value="drawer">Drawer</TabsTrigger>
                  <TabsTrigger value="popover">Popover</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label htmlFor="widget-playground-text">Label</Label>
              <Input
                id="widget-playground-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Feedback"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="widget-playground-variant">Variant</Label>
                <Select
                  value={variant}
                  onValueChange={(v) => setVariant(v as Variant)}
                >
                  <SelectTrigger id="widget-playground-variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="widget-playground-size">Size</Label>
                <Select
                  value={size}
                  onValueChange={(v) => setSize(v as Size)}
                >
                  <SelectTrigger id="widget-playground-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="widget-playground-classname">
                Custom Tailwind classes
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                  optional
                </span>
              </Label>
              <Input
                id="widget-playground-classname"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. bg-red-500 rounded-full px-8"
              />
              {selectedVariant?.hint && (
                <p className="text-muted-foreground text-xs">
                  {selectedVariant.hint}
                </p>
              )}
            </div>
          </div>

          {/* Right: Live preview + code */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Preview
              </span>
              <div className="bg-muted/30 border-border flex min-h-[120px] items-center justify-center rounded-md border px-4 py-6">
                <FeedbackButton
                  key={`${widget}-${variant}-${size}-${className}`}
                  platformId={orgId}
                  url={url}
                  widget={widget}
                  text={text || "Feedback"}
                  variant={variant}
                  size={size}
                  className={className || undefined}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Click the button to open the {widget} against your actual
                board.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Code
              </span>
              <Code code={snippet} lang="tsx" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
