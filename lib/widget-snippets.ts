/**
 * Pure-function snippet builder for the admin Widget docs playground.
 *
 * Default-valued props are omitted so the output stays minimal and reads
 * like the kind of code a developer would actually write by hand.
 */

export type Widget = "drawer" | "popover";

export type WidgetSnippetConfig = {
  orgId: string;
  url?: string;
  widget: Widget;
  text: string;
};

const TEXT_DEFAULT = "Feedback";
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

  lines.push(`    />`);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join("\n");
}
