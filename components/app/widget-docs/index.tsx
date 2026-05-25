"use client";

import { useMemo, useState } from "react";
import { FeedbackButton } from "feedbackland-react";
import { ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Code } from "@/components/ui/code";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsSelfHosted } from "@/hooks/use-is-self-hosted";
import { useVercelUrl } from "@/hooks/use-vercel-url";
import {
  buildPlaygroundSnippet,
  type Variant,
  type Size,
  type Widget,
} from "@/lib/widget-snippets";

const VARIANT_OPTIONS: { value: Variant; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
  { value: "ghost", label: "Ghost" },
  { value: "link", label: "Link" },
  { value: "destructive", label: "Destructive" },
  { value: "unstyled", label: "Unstyled" },
];

const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "sm", label: "Small" },
  { value: "lg", label: "Large" },
  { value: "icon", label: "Icon" },
  { value: "icon-sm", label: "Icon (small)" },
  { value: "icon-lg", label: "Icon (large)" },
];

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
  const [variant, setVariant] = useState<Variant>("default");
  const [size, setSize] = useState<Size>("default");
  const [className, setClassName] = useState("");

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
        variant,
        size,
        className,
      }),
    [orgId, url, widget, text, variant, size, className],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Configuration — sticky on wide viewports */}
      <div className="lg:sticky lg:top-8 lg:col-span-4">
        <Card className="bg-background">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Tweak the props; preview and code update live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label="Widget"
              hint={
                widget === "drawer"
                  ? "Slide-in side panel with the full board"
                  : "Anchored inline form; user stays in flow"
              }
              htmlFor="widget-flavor"
            >
              <Tabs
                value={widget}
                onValueChange={(v) => setWidget(v as Widget)}
              >
                <TabsList id="widget-flavor" className="grid w-full grid-cols-2">
                  <TabsTrigger value="drawer">Drawer</TabsTrigger>
                  <TabsTrigger value="popover">Popover</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>

            <Field label="Label" hint="Button text" htmlFor="widget-text">
              <Input
                id="widget-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Feedback"
              />
            </Field>

            <Field
              label="Variant"
              hint={
                variant === "unstyled"
                  ? "Strips internal classes — pair with className"
                  : "Visual style preset"
              }
              htmlFor="widget-variant"
            >
              <Select
                value={variant}
                onValueChange={(v) => setVariant(v as Variant)}
              >
                <SelectTrigger id="widget-variant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Size" hint="Size preset" htmlFor="widget-size">
              <Select
                value={size}
                onValueChange={(v) => setSize(v as Size)}
              >
                <SelectTrigger id="widget-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Tailwind className"
              hint="Optional override — your classes win conflicts"
              htmlFor="widget-classname"
            >
              <Input
                id="widget-classname"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="bg-red-500 rounded-full"
              />
            </Field>

            <p className="text-muted-foreground border-border border-t pt-4 text-xs">
              Want to bring your own button instead? Use the{" "}
              <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-[11px]">
                asChild
              </code>{" "}
              prop —{" "}
              <a
                href="https://github.com/feedbackland/feedbackland-react#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground inline-flex items-center gap-0.5 underline-offset-4 hover:underline"
              >
                README
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Preview + code */}
      <div className="space-y-4 lg:col-span-8">
        <div className="bg-background overflow-hidden rounded-xl border shadow-xs">
          <div className="bg-muted/20 flex items-center border-b px-4 py-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Preview
            </span>
          </div>
          <div className="relative flex min-h-[140px] w-full items-center justify-center px-4 py-8">
            <FeedbackButton
              platformId={orgId}
              url={url}
              widget={widget}
              text={text || "Feedback"}
              variant={variant}
              size={size}
              className={className || undefined}
            />
          </div>

          <div className="bg-muted/20 flex items-center border-y px-4 py-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Installation
            </span>
          </div>
          <Code
            code="npm install feedbackland-react"
            lang="bash"
            className="rounded-none! border-0 border-b"
          />

          <div className="bg-muted/20 flex items-center border-b px-4 py-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Usage
            </span>
          </div>
          <Code
            code={snippet}
            lang="tsx"
            className="rounded-none! border-0"
          />
        </div>
      </div>
    </div>
  );
}

/** Compact labelled form field with a one-line hint underneath. */
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
