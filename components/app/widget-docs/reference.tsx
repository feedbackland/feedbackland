"use client";

import { CopyButton } from "@/components/ui/copy-button";
import { Code } from "@/components/ui/code";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PropRow = {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
};

const props: PropRow[] = [
  {
    name: "platformId",
    type: "string (uuid)",
    required: true,
    description:
      "Your organization ID. Identifies which board feedback is routed to.",
  },
  {
    name: "url",
    type: "string",
    description:
      "Override the board origin. Required only for self-hosted instances.",
  },
  {
    name: "widget",
    type: '"drawer" | "popover"',
    default: '"drawer"',
    description:
      "Which presentation to use: slide-in side panel or anchored popover.",
  },
  {
    name: "text",
    type: "string",
    default: '"Feedback"',
    description: "Label for the default styled button. Ignored when children is provided.",
  },
  {
    name: "variant",
    type: '"default" | "secondary" | "outline" | "ghost" | "link" | "destructive" | "unstyled"',
    default: '"default"',
    description:
      'Visual style of the trigger. "unstyled" strips all internal classes so className is the sole source of truth.',
  },
  {
    name: "size",
    type: '"default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"',
    default: '"default"',
    description: "Built-in size preset for the styled button.",
  },
  {
    name: "className",
    type: "string",
    description:
      "Tailwind classes merged onto the trigger via tailwind-merge. Yours win conflicts.",
  },
  {
    name: "asChild",
    type: "boolean",
    default: "false",
    description:
      "When true, your child element becomes the trigger directly. Requires a single React element child.",
  },
  {
    name: "children",
    type: "React.ReactNode",
    description:
      "Overrides text for the default trigger. Required when asChild is true.",
  },
];

export function PropsReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Props reference</CardTitle>
        <CardDescription>
          Every prop the FeedbackButton accepts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr className="text-left">
                <th scope="col" className="px-4 py-2 font-medium">
                  Prop
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Default
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {props.map((p) => (
                <tr key={p.name} className="border-border border-t align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <code className="text-foreground font-mono text-xs">
                        {p.name}
                      </code>
                      {p.required && (
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                          required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                    {p.type}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                    {p.default ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlatformIdCard({ orgId }: { orgId: string }) {
  return (
    <div className="bg-background border-border space-y-2 rounded-lg border p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Your platform ID</h3>
        <span className="text-muted-foreground text-xs">
          Pass as <code className="bg-muted/40 rounded px-1 py-0.5 font-mono text-[11px]">platformId</code>
        </span>
      </div>
      <div className="bg-muted/30 border-input flex items-center gap-2 rounded-md border px-3 py-2">
        <code className="text-foreground flex-1 truncate font-mono text-xs">
          {orgId}
        </code>
        <CopyButton text={orgId} />
      </div>
    </div>
  );
}

export function InstallCard() {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Install</h3>
      <Code code="npm install feedbackland-react" lang="bash" />
    </div>
  );
}
