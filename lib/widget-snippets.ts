/**
 * Pure-function snippet builder for the admin Widget docs playground.
 *
 * Default-valued props are omitted so the output stays minimal and reads
 * like the kind of code a developer would actually write by hand.
 */

export type Widget = "drawer" | "popover";

export type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "link"
  | "destructive"
  | "unstyled";

export type Size =
  | "default"
  | "sm"
  | "lg"
  | "icon"
  | "icon-sm"
  | "icon-lg";

export type WidgetSnippetConfig = {
  orgId: string;
  url?: string;
  widget: Widget;
  text: string;
  variant: Variant;
  size: Size;
  className: string;
};

const TEXT_DEFAULT = "Feedback";
const VARIANT_DEFAULT: Variant = "default";
const SIZE_DEFAULT: Size = "default";
const WIDGET_DEFAULT: Widget = "drawer";

/** Render a JSX attribute value — JSON.stringify handles embedded quotes. */
function jsxStr(value: string): string {
  return JSON.stringify(value);
}

export function buildPlaygroundSnippet(c: WidgetSnippetConfig): string {
  const lines: string[] = [
    `import { FeedbackButton } from "feedbackland-react";`,
    ``,
    `export function GiveFeedback() {`,
    `  return (`,
    `    <FeedbackButton`,
    `      platformId=${jsxStr(c.orgId)}`,
  ];

  if (c.url) lines.push(`      url=${jsxStr(c.url)}`);
  if (c.widget !== WIDGET_DEFAULT)
    lines.push(`      widget=${jsxStr(c.widget)}`);
  if (c.text && c.text !== TEXT_DEFAULT)
    lines.push(`      text=${jsxStr(c.text)}`);
  if (c.variant !== VARIANT_DEFAULT)
    lines.push(`      variant=${jsxStr(c.variant)}`);
  if (c.size !== SIZE_DEFAULT) lines.push(`      size=${jsxStr(c.size)}`);
  if (c.className) lines.push(`      className=${jsxStr(c.className)}`);

  lines.push(`    />`);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join("\n");
}
