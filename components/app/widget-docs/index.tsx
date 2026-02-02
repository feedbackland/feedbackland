"use client";

import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOverlayWidgetCodeSnippet } from "@/lib/utils";
import { FeedbackButton } from "feedbackland-react";

export function WidgetDocs({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) {
  const [type, setType] = useState<"drawer" | "popover">("drawer");
  const [text, setText] = useState("Feedback");
  const [variant, setVariant] = useState("default");
  const [size, setSize] = useState("default");

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Configuration Panel */}
      <div className="lg:sticky lg:top-8 lg:col-span-4">
        <Card className="bg-background">
          <CardHeader className="">
            <CardTitle className="">Configuration</CardTitle>
            <CardDescription className="">
              Customize the look and feel of your widget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <Select
                value={type}
                onValueChange={(val: "drawer" | "popover") => setType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drawer">Drawer</SelectItem>
                  <SelectItem value="popover">Popover</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Text</Label>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Button text"
              />
            </div>

            <div className="space-y-2">
              <Label>Variant</Label>
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="ghost">Ghost</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview & Code Section */}
      <div className="space-y-6 lg:col-span-8">
        <div className="flex flex-col items-stretch space-y-4">
          <div className="overflow-hidden rounded-xl border shadow-sm">
            {/* Live Preview Area */}
            <div className="bg-background relative flex h-32 w-full items-center justify-center">
              {/* <Label className="text-muted-foreground absolute top-2 left-2.5 text-xs font-normal">
                PREVIEW
              </Label> */}
              <FeedbackButton
                platformId={orgId}
                widget={type}
                text={text}
                variant={variant as any}
                size={size as any}
              />
            </div>

            {/* Code Snippets */}
            <div className="border-t">
              <div className="bg-muted/20 flex items-center border-b px-4 py-2">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Installation
                </span>
              </div>
              <Code
                code={`npm i feedbackland-react`}
                lang="bash"
                className="rounded-none! border-0 border-b"
              />

              <div className="bg-muted/20 flex items-center border-b px-4 py-2">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Usage
                </span>
              </div>
              <Code
                code={getOverlayWidgetCodeSnippet({
                  orgId,
                  orgSubdomain,
                  type,
                  text,
                  variant,
                  size,
                })}
                lang="tsx"
                className="rounded-none! border-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
