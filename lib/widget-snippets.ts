/**
 * Pure-function snippet builders for the admin Widget docs page.
 *
 * Two responsibilities:
 *   1. `buildPlaygroundSnippet` — generate a JSX snippet from the live
 *      playground configuration.
 *   2. `buildExample` — generate one of four canned "Style your way"
 *      snippets that demonstrate the supported customisation patterns.
 *
 * Snippets are designed to be copy-paste-runnable in a Tailwind + React
 * host project. Default-valued props are omitted so output stays minimal.
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

/**
 * JSX attribute value — uses `JSON.stringify` so embedded quotes, newlines,
 * etc. survive the round-trip into the rendered snippet correctly.
 */
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

export type StylePattern = "default" | "className" | "unstyled" | "asChild";

export function buildExample(pattern: StylePattern, orgId: string): string {
  switch (pattern) {
    case "default":
      return `<FeedbackButton platformId="${orgId}" />`;

    case "className":
      return `<FeedbackButton
  platformId="${orgId}"
  className="bg-red-500 hover:bg-red-600 rounded-full px-8"
/>`;

    case "unstyled":
      return `<FeedbackButton
  platformId="${orgId}"
  variant="unstyled"
  className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
/>`;

    case "asChild":
      return `<FeedbackButton platformId="${orgId}" asChild>
  <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
    Share feedback
  </button>
</FeedbackButton>`;
  }
}

/** Used by the variant comparison cards. */
export function buildVariantOnlySnippet(
  widget: Widget,
  orgId: string,
): string {
  if (widget === "drawer") {
    // Drawer is the default — omit the `widget` prop.
    return `<FeedbackButton platformId="${orgId}" />`;
  }
  return `<FeedbackButton platformId="${orgId}" widget="popover" />`;
}
