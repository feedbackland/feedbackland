# Widget Button Customisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `feedbackland-react`'s trigger button as a compound `Feedback` / `Feedback.Trigger` API with full DOM passthrough, icon/shape/placement options, theming and programmatic opening — plus a preset gallery that makes the good defaults discoverable.

**Architecture:** Open state lifts out of `OverlayWidget` / `PopoverWidget` into a new `Feedback` root that provides context. `FeedbackTrigger` is a `forwardRef` button extending `ComponentProps<"button">` that wires itself to the active widget mode. `FeedbackButton` survives as a thin collapse of the two over the union prop type, so the one-liner integration is untouched.

**Tech Stack:** React 17/18/19 (peer), TypeScript, Tailwind 4 with the `fl:` prefix, Radix Popover + Slot, Vaul Drawer, CVA, `tailwind-merge`, Vite library build.

**Spec:** `docs/superpowers/specs/2026-07-25-widget-button-customisation-design.md`

## Global Constraints

- Package version ends at **3.0.0**. Use `npm version major -w feedbackland-react` — `package.json:15`'s `release:react` script says `patch` and must be updated.
- **No test runner exists in this repo, and `npm run lint` is broken under Next 16.** Do not add one — it is explicitly out of scope for this plan. Every task's verification is therefore: a typecheck/build gate with exact expected output, plus a named manual check in the dev harness. Treat a failing gate exactly as you would a failing test — stop and fix before moving on.
- **The workspace symlink resolves `feedbackland-react` to `dist/`, not `src/`.** The Next app sees nothing until the package is rebuilt. Use `npm run widget-dev` (`package.json:22`) for any check that involves the admin app.
- Every Tailwind utility inside the package must carry the `fl:` prefix. Unprefixed classes will not exist in the built stylesheet.
- `cn()` (`src/lib/utils.ts:7`) strips the `fl:` prefix before `twMerge`, so consumer classes win conflicts. Non-utility classes (`fl-scope`, `fl-dark`, `fl-light`) pass through untouched — they are hyphenated, not prefixed.
- Peer range includes React 17/18, so **ref must go through `React.forwardRef`**, never ref-as-prop.
- Zero-config `<FeedbackButton platformId="…" />` must stay pixel-identical to 2.x: no icon on text sizes.
- Known pre-existing issue, **do not fix and do not worsen**: `useTheme`'s `useState` initialiser reads the DOM, so the drawer's iframe `src` can hydration-mismatch in a class-dark host. Fixing it would force a double iframe load.

---

### Task 1: Foundations — context, controllable state, tokens

**Files:**
- Create: `feedbackland-react/src/context.tsx`
- Create: `feedbackland-react/src/lib/tokens.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FeedbackContextValue`, `FeedbackTriggerMode`, `FeedbackProvider`, `useFeedback()`, `useControllableState<T>()`, `FeedbackToken`, `FeedbackTokens`, `resolveTokenStyle()`.

- [ ] **Step 1: Create `src/lib/tokens.ts`**

```ts
import type * as React from "react";

/**
 * The subset of `--fl-*` custom properties that affect surfaces a consumer can
 * actually see (trigger + panel). Chart and sidebar tokens are deliberately
 * excluded — nothing in the widget renders them.
 */
export const FEEDBACK_TOKENS = [
  "radius",
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "border",
  "input",
  "ring",
] as const;

export type FeedbackToken = (typeof FEEDBACK_TOKENS)[number];

export type FeedbackTokens = Partial<Record<FeedbackToken, string>>;

/** `primaryForeground` -> `--fl-primary-foreground` */
function toCssVar(token: string): string {
  return `--fl-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/**
 * Turn a `tokens` prop into an inline style object of CSS custom properties.
 * Returns `undefined` when there is nothing to set, so callers can spread it
 * without producing an empty `style` attribute.
 */
export function resolveTokenStyle(
  tokens?: FeedbackTokens,
): React.CSSProperties | undefined {
  if (!tokens) return undefined;

  const entries = Object.entries(tokens).filter(
    ([, value]) => typeof value === "string" && value.length > 0,
  );
  if (entries.length === 0) return undefined;

  return Object.fromEntries(
    entries.map(([key, value]) => [toCssVar(key), value]),
  ) as unknown as React.CSSProperties;
}
```

- [ ] **Step 2: Create `src/context.tsx`**

```tsx
"use client";

import * as React from "react";
import type { FeedbackTheme } from "./hooks/use-theme";

/**
 * How a trigger must wire itself up for the currently-active presentation:
 *  - "overlay": the slide-in drawer — plain onClick, we own the ARIA attributes
 *  - "popover": Radix Popover on desktop — wrap in `PopoverTrigger`
 *  - "drawer":  Vaul bottom sheet on mobile — wrap in `DrawerTrigger`
 */
export type FeedbackTriggerMode = "overlay" | "popover" | "drawer";

export type FeedbackContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  triggerMode: FeedbackTriggerMode;
  /** Spread onto a custom element for the headless tier. Drawer mode only —
   *  popover mode needs a Radix anchor, so use `Feedback.Trigger asChild`. */
  triggerProps: {
    onClick: () => void;
    "aria-haspopup": "dialog";
    "aria-expanded": boolean;
  };
  /** Inline `--fl-*` properties resolved from the root's `tokens` prop. */
  tokenStyle: React.CSSProperties | undefined;
  /** Resolved theme value, for consumers that need to branch in JS. */
  theme: FeedbackTheme;
  /** `"fl-dark"` / `"fl-light"` when the root's `theme` prop is explicit,
   *  `undefined` when it is "auto" — in which case the CSS `html.dark`
   *  selector handles it, which keeps SSR output stable. */
  themeClass: "fl-dark" | "fl-light" | undefined;
};

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

export const FeedbackProvider = FeedbackContext.Provider;

export function useFeedback(): FeedbackContextValue {
  const ctx = React.useContext(FeedbackContext);
  if (!ctx) {
    throw new Error(
      "[feedbackland-react] useFeedback() must be called from a component " +
        "rendered inside <Feedback>. Children passed to <Feedback> are " +
        "evaluated in the parent's scope, where the provider is not yet in " +
        "effect — move the hook into a child component.",
    );
  }
  return ctx;
}

/**
 * Minimal controlled/uncontrolled state. Written locally rather than pulling in
 * `@radix-ui/react-use-controllable-state`, which is not currently a dependency.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue: T;
  onChange?: (next: T) => void;
}): [T, (next: T) => void] {
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? (value as T) : uncontrolled;

  // Kept in a ref so `setValue` stays referentially stable across renders even
  // when the consumer passes an inline arrow function.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const setValue = React.useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChangeRef.current?.(next);
    },
    [isControlled],
  );

  return [current, setValue];
}
```

- [ ] **Step 3: Verify the package still builds**

Run: `npm run build -w feedbackland-react`
Expected: PASS. Vite prints `built in …` with no TypeScript diagnostics. Both new modules compile even though nothing imports them yet.

- [ ] **Step 4: Commit**

```bash
git add feedbackland-react/src/context.tsx feedbackland-react/src/lib/tokens.ts
git commit -m "feat(feedbackland-react): add feedback context, controllable state, token resolver"
```

---

### Task 2: Dark mode gets one source of truth

Closes gap #7. Independent of the component restructure, so it lands first and can be verified on its own.

**Files:**
- Modify: `feedbackland-react/src/index.css:1-3` (add custom variant), `:487` (dark var selector)
- Modify: `feedbackland-react/src/OverlayWidget.tsx:294`, `:340-341`
- Modify: `feedbackland-react/src/PopoverWidget.tsx:275`, `:290`, `:294`

**Interfaces:**
- Consumes: nothing.
- Produces: the `fl-dark` / `fl-light` class contract that Tasks 4 and 5 rely on.

- [ ] **Step 1: Add the custom dark variant to `src/index.css`**

Insert after line 3 (`@import "tw-animate-css/prefix";`):

```css

/*
  Single source of truth for dark mode. Three ways in, one result:
   - `.fl-dark` on a widget element — set when the `theme` prop is explicit.
   - `html.dark` on the host page — the CSS-only path, so a class-dark host
     renders correctly during SSR with no JS involved.
   - `.fl-light` opts an element (and its subtree) back out, which is what
     makes `theme="light"` work inside an `html.dark` host.

  Before this, `fl:dark:*` utilities resolved via `prefers-color-scheme` while
  the `--fl-*` variables flipped on `html.dark`, so a class-dark host with a
  light OS got light utilities painted over dark tokens.
*/
@custom-variant dark (&:where(.fl-dark, .fl-dark *, html.dark :not(.fl-light):not(.fl-light *)));
```

- [ ] **Step 2: Widen the dark variable selector in `src/index.css`**

Change line 487 from:

```css
html.dark .fl-scope {
```

to:

```css
.fl-scope.fl-dark,
html.dark .fl-scope:not(.fl-light) {
```

- [ ] **Step 3: Replace the dead `dark` classes in `src/OverlayWidget.tsx`**

Line 294 — the `Slot` wrapping the trigger:

```tsx
        <Slot onClick={handleOpen} className={cn({ "fl-dark": isDarkMode })}>
```

Lines 340-341 — inside the panel's `cn` object:

```tsx
                      "fl:border-l-1 fl:border-border": isDarkMode,
                      "fl-dark": isDarkMode,
```

- [ ] **Step 4: Replace the dead `dark` classes in `src/PopoverWidget.tsx`**

Line 275 — `DrawerContent` currently has no dark class at all:

```tsx
        <DrawerContent
          className={cn("fl-scope fl:p-4", { "fl-dark": isDarkMode })}
        >
```

Line 290 — `PopoverTrigger`:

```tsx
          <PopoverTrigger asChild className={cn({ "fl-dark": isDarkMode })}>
```

Line 294 — `PopoverContent`:

```tsx
          <PopoverContent
            className={cn("fl-scope fl:w-[400px]", { "fl-dark": isDarkMode })}
          >
```

- [ ] **Step 5: Build and verify**

Run: `npm run build -w feedbackland-react`
Expected: PASS, `built in …`. If Tailwind rejects the `@custom-variant` line the build fails loudly with a CSS parse error — that is the signal the selector syntax is wrong.

- [ ] **Step 6: Manual check — the bug this fixes**

Run: `npm run dev -w feedbackland-react`

In devtools, set `<html class="dark">` while your OS is in **light** mode, then look at a `variant="outline"` trigger (`src/main.tsx` renders one at line 11).

Expected: the outline button renders with dark-mode surface colours (`fl:dark:bg-input/30`) matching its dark `--fl-*` variables. Before this change it rendered light utilities over dark tokens — a light border and background on a dark panel.

- [ ] **Step 7: Commit**

```bash
git add feedbackland-react/src/index.css feedbackland-react/src/OverlayWidget.tsx feedbackland-react/src/PopoverWidget.tsx
git commit -m "fix(feedbackland-react): make dark mode resolve by class for both variables and utilities"
```

---

### Task 3: Lift open state out of the widgets

Purely mechanical — no behaviour change. `FeedbackButton` temporarily owns the state so the build stays green; Task 4 moves it to the root.

**Files:**
- Modify: `feedbackland-react/src/OverlayWidget.tsx:97-121`, `:107`, `:266-272`
- Modify: `feedbackland-react/src/PopoverWidget.tsx:46-69`, `:141-152`, `:272-300`
- Modify: `feedbackland-react/src/FeedbackButton.tsx:103-112`

**Interfaces:**
- Consumes: nothing from Task 1 yet.
- Produces: `OverlayWidget` and `PopoverWidget` both accept `open: boolean` and `onOpenChange: (next: boolean) => void`; `PopoverWidget` additionally accepts `isDesktop: boolean`, `side`, `align`, `width`.

- [ ] **Step 1: Change `OverlayWidget`'s props and drop its internal state**

Replace the destructuring block at `src/OverlayWidget.tsx:97-106`:

```tsx
export const OverlayWidget = memo(
  ({
    platformId,
    url,
    open,
    onOpenChange,
    children,
  }: {
    platformId: string;
    url?: string;
    open: boolean;
    onOpenChange: (next: boolean) => void;
    children?: React.ReactNode;
  }) => {
    const isOpened = open;
```

Then delete line 107 (`const [isOpened, setIsOpened] = useState(false);`) and rewrite the two handlers at lines 266-272:

```tsx
    const handleOpen = useCallback(() => {
      onOpenChange(true);
    }, [onOpenChange]);

    const handleClose = useCallback(() => {
      onOpenChange(false);
    }, [onOpenChange]);
```

- [ ] **Step 2: Change `PopoverWidget`'s props and drop its internal state**

Replace the destructuring block at `src/PopoverWidget.tsx:46-55`:

```tsx
export const PopoverWidget = memo(
  ({
    platformId,
    url,
    open,
    onOpenChange,
    isDesktop,
    side = "bottom",
    align = "center",
    width = 400,
    children,
  }: {
    platformId: string;
    url?: string;
    open: boolean;
    onOpenChange: (next: boolean) => void;
    isDesktop: boolean;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    width?: number | string;
    children?: React.ReactNode;
  }) => {
```

Delete line 65 (`const [open, setOpen] = useState(false);`) and line 69 (`const isDesktop = useMediaQuery(...)`), plus the now-unused `useMediaQuery` import at line 20 and the `DESKTOP_BREAKPOINT_QUERY` constant at line 34.

- [ ] **Step 3: Rename `PopoverWidget`'s internal open handler**

The prop is now called `onOpenChange`, which collides with the local function of the same name at line 141. Rename the local one and keep its status-reset behaviour:

```tsx
    const handleOpenChange = (next: boolean) => {
      onOpenChange(next);
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
      // Wait for the close animation before flipping the form back to its
      // "active" state, so success/error UI doesn't flash on the way out.
      resetTimeoutRef.current = window.setTimeout(() => {
        setStatus("active");
        resetTimeoutRef.current = null;
      }, STATUS_RESET_DELAY_MS);
    };
```

Update both render branches (lines 273 and 289) to use `onOpenChange={handleOpenChange}`.

- [ ] **Step 4: Apply the popover geometry props**

At `src/PopoverWidget.tsx:293-297`, replace the hardcoded width with the props:

```tsx
          <PopoverContent
            side={side}
            align={align}
            style={{ width: typeof width === "number" ? `${width}px` : width }}
            className={cn("fl-scope", { "fl-dark": isDarkMode })}
          >
```

Note `fl:w-[400px]` is gone from the className — the inline `style` now owns width.

- [ ] **Step 5: Hold the state in `FeedbackButton` for now**

At `src/FeedbackButton.tsx`, add `useState` above the `inner` assignment and thread it through both widgets:

```tsx
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)", true);

  const inner =
    widget === "popover" ? (
      <PopoverWidget
        platformId={platformId}
        url={url}
        open={open}
        onOpenChange={setOpen}
        isDesktop={isDesktop}
      >
        {trigger}
      </PopoverWidget>
    ) : (
      <OverlayWidget
        platformId={platformId}
        url={url}
        open={open}
        onOpenChange={setOpen}
      >
        {trigger}
      </OverlayWidget>
    );
```

Add the import: `import { useMediaQuery } from "./hooks/use-media-query";`

- [ ] **Step 6: Build and verify**

Run: `npm run build -w feedbackland-react`
Expected: PASS. Any leftover reference to the deleted `setIsOpened` / `setOpen` / `useMediaQuery` in the widgets surfaces here as a TypeScript error.

- [ ] **Step 7: Manual check — nothing changed**

Run: `npm run dev -w feedbackland-react`

Expected: both triggers in `src/main.tsx` still open and close exactly as before. The drawer slides in and closes on Escape, backdrop click, and the X button. The popover opens anchored to its trigger and its submit form still works. Resize below 768px and confirm the popover becomes a bottom sheet.

- [ ] **Step 8: Commit**

```bash
git add feedbackland-react/src
git commit -m "refactor(feedbackland-react): lift widget open state into the caller"
```

---

### Task 4: The compound API — `Feedback` root and `Feedback.Trigger`

The heart of the change. Root and Trigger ship together because neither is usable alone: the popover needs its trigger rendered inside the Radix `Popover` subtree, and the trigger needs the root's context.

**Files:**
- Create: `feedbackland-react/src/Feedback.tsx`
- Create: `feedbackland-react/src/FeedbackTrigger.tsx`
- Modify: `feedbackland-react/src/components/ui/button.tsx:7-88`
- Modify: `feedbackland-react/src/OverlayWidget.tsx:290-296` (stop wrapping children)
- Modify: `feedbackland-react/src/PopoverWidget.tsx:272-300` (stop wrapping children)
- Modify: `feedbackland-react/src/FeedbackButton.tsx` (full rewrite)
- Modify: `feedbackland-react/src/index.ts`

**Interfaces:**
- Consumes: `FeedbackProvider`, `useFeedback`, `useControllableState`, `FeedbackContextValue`, `FeedbackTriggerMode` from Task 1's `context.tsx`; `resolveTokenStyle`, `FeedbackTokens` from Task 1's `tokens.ts`; the `open`/`onOpenChange`/`isDesktop`/`side`/`align`/`width` widget props from Task 3; the `fl-dark`/`fl-light` contract from Task 2.
- Produces: `Feedback`, `FeedbackRootProps`, `FeedbackTrigger`, `FeedbackTriggerProps`, `FeedbackVariant`, `FeedbackSize`, `FeedbackShape`, `FeedbackPlacement`, `FeedbackButtonProps`.

- [ ] **Step 1: Add `shape` to the button CVA and convert `Button` to `forwardRef`**

In `src/components/ui/button.tsx`, add a `shape` group to the `variants` object **after** `size` (declaration order decides which `rounded-*` wins inside `cn`'s `twMerge` pass), and extend `defaultVariants`:

```ts
      shape: {
        default: "",
        pill: "fl:rounded-full",
        square: "fl:rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
```

Also drop `ref` from the props interface, since `forwardRef` supplies it:

```ts
export interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}
```

Then convert the component so it accepts a ref (React 17/18 cannot use ref-as-prop) and forwards `shape`:

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    loading = false,
    variant,
    size,
    shape,
    asChild = false,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        buttonVariants({ variant, size, shape, className }),
        "fl:relative",
      )}
      disabled={!!(loading || disabled)}
      {...props}
    >
      {loading && (
        <div className="fl:absolute fl:top-1/2 fl:left-1/2 fl:-translate-x-1/2 fl:-translate-y-1/2">
          <Spinner
            className={cn("fl:size-6!", size === "icon" && "fl:size-5!")}
          />
        </div>
      )}
      <Slottable>
        <span
          className={cn(
            "fl:inline-flex fl:items-center fl:justify-center fl:gap-2",
            loading && "fl:opacity-0",
          )}
        >
          {children}
        </span>
      </Slottable>
    </Comp>
  );
});
```

- [ ] **Step 2: Stop the widgets from wrapping their children**

The trigger now wires itself, so the widgets just render children in place.

`src/OverlayWidget.tsx` — replace the `<Slot>` block at lines 290-296 with:

```tsx
        {/* Trigger — rendered as-is. `FeedbackTrigger` (or a headless element
            using `useFeedback().triggerProps`) attaches its own open handler,
            so the widget no longer needs to inject one. */}
        {children}
```

Remove the now-unused `Slot` import at line 12.

`src/PopoverWidget.tsx` — line 274 becomes `{children}` (drop `<DrawerTrigger asChild>`), and line 290 becomes `{children}` (drop `<PopoverTrigger asChild>`). Leave the `DrawerTrigger` / `PopoverTrigger` imports in place only if still referenced; otherwise remove them.

- [ ] **Step 3: Create `src/FeedbackTrigger.tsx`**

```tsx
"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { type ClassValue } from "clsx";
import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";
import { DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useFeedback } from "./context";

type StyledVariant =
  | "default"
  | "link"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary";

export type FeedbackVariant = StyledVariant | "unstyled";

export type FeedbackSize =
  | "default"
  | "sm"
  | "lg"
  | "icon"
  | "icon-sm"
  | "icon-lg";

export type FeedbackShape = "default" | "pill" | "square";

export type FeedbackPlacement =
  | "inline"
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

const ICON_SIZES: ReadonlySet<FeedbackSize> = new Set([
  "icon",
  "icon-sm",
  "icon-lg",
]);

// Sits above typical host chrome but below the widget's own backdrop
// (2147483646) and panel (2147483647), so an open drawer covers the button
// rather than the button punching through it.
//
// `bottom-(--fl-offset)` is Tailwind 4's CSS-variable shorthand. If the built
// stylesheet turns out not to contain these classes, fall back to the explicit
// arbitrary-value form — `fl:bottom-[var(--fl-offset)]` — which works on every
// v4 release. Verify by grepping the built CSS for `fl\:bottom-` after the
// first build of this task.
const PLACEMENT_CLASSES: Record<Exclude<FeedbackPlacement, "inline">, string> =
  {
    "bottom-right":
      "fl:fixed fl:z-2147483640 fl:bottom-(--fl-offset) fl:right-(--fl-offset)",
    "bottom-left":
      "fl:fixed fl:z-2147483640 fl:bottom-(--fl-offset) fl:left-(--fl-offset)",
    "top-right":
      "fl:fixed fl:z-2147483640 fl:top-(--fl-offset) fl:right-(--fl-offset)",
    "top-left":
      "fl:fixed fl:z-2147483640 fl:top-(--fl-offset) fl:left-(--fl-offset)",
  };

// `ref` is omitted because `forwardRef` supplies it as its own parameter —
// React 19's `ComponentProps<"button">` includes `ref`, and leaving it in
// collides with the forwardRef signature.
export type FeedbackTriggerProps = Omit<
  React.ComponentProps<"button">,
  "children" | "className" | "ref"
> & {
  text?: string;
  /** `true` (or bare) uses the built-in glyph, an element uses yours, `false`
   *  removes it. Omitted means: glyph on icon sizes, nothing on text sizes. */
  icon?: boolean | React.ReactNode;
  iconPosition?: "start" | "end";
  variant?: FeedbackVariant;
  size?: FeedbackSize;
  shape?: FeedbackShape;
  placement?: FeedbackPlacement;
  offset?: number | string;
  className?: ClassValue;
  asChild?: boolean;
  children?: React.ReactNode;
};

export const FeedbackTrigger = React.forwardRef<
  HTMLButtonElement,
  FeedbackTriggerProps
>(function FeedbackTrigger(
  {
    text = "Feedback",
    icon,
    iconPosition = "start",
    variant = "default",
    size = "default",
    shape = "default",
    placement = "inline",
    offset = "1.5rem",
    className,
    style,
    asChild = false,
    children,
    onClick,
    "aria-label": ariaLabelProp,
    ...rest
  },
  ref,
) {
  const { open, isOpen, triggerMode, tokenStyle, themeClass } = useFeedback();

  const isIconSize = ICON_SIZES.has(size);

  React.useEffect(() => {
    if (variant === "unstyled" && (size !== "default" || shape !== "default")) {
      // eslint-disable-next-line no-console
      console.warn(
        '[feedbackland-react] <Feedback.Trigger variant="unstyled"> ignores ' +
          "`size` and `shape` — the unstyled trigger renders no visual " +
          "classes at all. Express the size and shape via `className`.",
      );
    }
  }, [variant, size, shape]);

  // Size-dependent default: icon sizes get the glyph so they are usable out of
  // the box; text sizes get nothing so the zero-config button is unchanged.
  let resolvedIcon: React.ReactNode = null;
  if (icon === true || (icon === undefined && isIconSize)) {
    resolvedIcon = <MessageSquare aria-hidden="true" />;
  } else if (icon !== false && icon !== undefined) {
    resolvedIcon = icon;
  }

  const content =
    children ??
    (isIconSize ? (
      resolvedIcon
    ) : (
      <>
        {iconPosition === "start" && resolvedIcon}
        {text}
        {iconPosition === "end" && resolvedIcon}
      </>
    ));

  // An icon-only button has no text node, so it must carry a name. An explicit
  // `aria-label` always wins.
  const ariaLabel = ariaLabelProp ?? (isIconSize ? text : undefined);

  const placementClass =
    placement === "inline" ? undefined : PLACEMENT_CLASSES[placement];

  const mergedStyle: React.CSSProperties = {
    ...tokenStyle,
    ...(placement !== "inline"
      ? {
          ["--fl-offset" as string]:
            typeof offset === "number" ? `${offset}px` : offset,
        }
      : null),
    ...style,
  };

  // In popover / drawer mode the Radix trigger owns the click and the ARIA
  // state; attaching ours too would fight it (its toggle-to-closed followed by
  // our set-to-open would make the trigger unable to close the panel).
  const ownsClick = triggerMode === "overlay";

  const handleClick = ownsClick
    ? (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) open();
      }
    : onClick;

  const ariaProps = ownsClick
    ? ({ "aria-haspopup": "dialog", "aria-expanded": isOpen } as const)
    : {};

  let node: React.ReactElement;

  if (asChild) {
    // Bring-your-own-element. No `fl-scope` — the child lives in the host's
    // own typographic and box-model context by design.
    node = (
      <Slot
        ref={ref as React.Ref<HTMLElement>}
        onClick={handleClick}
        className={cn(placementClass, className)}
        style={mergedStyle}
        {...ariaProps}
        {...rest}
      >
        {children}
      </Slot>
    );
  } else if (variant === "unstyled") {
    // The widget's own <button> with zero visual classes. Also unscoped —
    // `className` is the single source of visual rules.
    node = (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        className={cn(placementClass, className)}
        style={mergedStyle}
        aria-label={ariaLabel}
        {...ariaProps}
        {...rest}
      >
        {content}
      </button>
    );
  } else {
    // `fl-scope` sits on the button itself rather than a wrapper div, so the
    // trigger is a single DOM node that can be inline, a grid child, or fixed.
    node = (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        shape={shape}
        onClick={handleClick}
        className={cn("fl-scope", themeClass, placementClass, className)}
        style={mergedStyle}
        aria-label={ariaLabel}
        {...ariaProps}
        {...rest}
      >
        {content}
      </Button>
    );
  }

  if (triggerMode === "popover") {
    return <PopoverTrigger asChild>{node}</PopoverTrigger>;
  }
  if (triggerMode === "drawer") {
    return <DrawerTrigger asChild>{node}</DrawerTrigger>;
  }
  return node;
});

FeedbackTrigger.displayName = "FeedbackTrigger";
```

- [ ] **Step 4: Create `src/Feedback.tsx`**

```tsx
"use client";

import * as React from "react";
import "./index.css";
import { OverlayWidget } from "./OverlayWidget";
import { PopoverWidget } from "./PopoverWidget";
import { FeedbackTrigger } from "./FeedbackTrigger";
import {
  FeedbackProvider,
  useControllableState,
  type FeedbackContextValue,
  type FeedbackTriggerMode,
} from "./context";
import { resolveTokenStyle, type FeedbackTokens } from "./lib/tokens";
import { useTheme, type FeedbackThemeOption } from "./hooks/use-theme";
import { useMediaQuery } from "./hooks/use-media-query";

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 768px)";

export type FeedbackRootProps = {
  platformId: string;
  url?: string;
  widget?: "drawer" | "popover";
  theme?: FeedbackThemeOption;
  tokens?: FeedbackTokens;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Popover geometry. Ignored by `widget="drawer"`. */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  width?: number | string;
  children?: React.ReactNode;
};

export const Feedback = ({
  platformId,
  url,
  widget = "drawer",
  theme: themeOption = "auto",
  tokens,
  open,
  defaultOpen = false,
  onOpenChange,
  side = "bottom",
  align = "center",
  width = 400,
  children,
}: FeedbackRootProps) => {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const theme = useTheme(themeOption);
  const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT_QUERY, true);
  const tokenStyle = React.useMemo(() => resolveTokenStyle(tokens), [tokens]);

  // Only stamp an explicit class when the consumer forced a theme. On "auto"
  // we leave it to the `html.dark` CSS selector, which keeps server and client
  // markup identical.
  const themeClass: "fl-dark" | "fl-light" | undefined =
    themeOption === "auto" ? undefined : themeOption === "dark" ? "fl-dark" : "fl-light";

  const openFn = React.useCallback(() => setOpen(true), [setOpen]);
  const closeFn = React.useCallback(() => setOpen(false), [setOpen]);
  const toggleFn = React.useCallback(
    () => setOpen(!isOpen),
    [setOpen, isOpen],
  );

  const triggerMode: FeedbackTriggerMode =
    widget === "popover" ? (isDesktop ? "popover" : "drawer") : "overlay";

  const value = React.useMemo<FeedbackContextValue>(
    () => ({
      isOpen,
      open: openFn,
      close: closeFn,
      toggle: toggleFn,
      triggerMode,
      triggerProps: {
        onClick: openFn,
        "aria-haspopup": "dialog",
        "aria-expanded": isOpen,
      },
      tokenStyle,
      theme,
      themeClass,
    }),
    [
      isOpen,
      openFn,
      closeFn,
      toggleFn,
      triggerMode,
      tokenStyle,
      theme,
      themeClass,
    ],
  );

  const inner =
    widget === "popover" ? (
      <PopoverWidget
        platformId={platformId}
        url={url}
        open={isOpen}
        onOpenChange={setOpen}
        isDesktop={isDesktop}
        side={side}
        align={align}
        width={width}
      >
        {children}
      </PopoverWidget>
    ) : (
      <OverlayWidget
        platformId={platformId}
        url={url}
        open={isOpen}
        onOpenChange={setOpen}
      >
        {children}
      </OverlayWidget>
    );

  return <FeedbackProvider value={value}>{inner}</FeedbackProvider>;
};

Feedback.Trigger = FeedbackTrigger;
Feedback.displayName = "Feedback";
```

- [ ] **Step 5: Rewrite `src/FeedbackButton.tsx` as the collapse**

Replace the entire file:

```tsx
"use client";

import * as React from "react";
import { Feedback, type FeedbackRootProps } from "./Feedback";
import { FeedbackTrigger, type FeedbackTriggerProps } from "./FeedbackTrigger";

/**
 * The one-liner. Takes the union of root and trigger props and routes each to
 * the right half, so `<FeedbackButton platformId="…" />` stays the whole
 * integration. Reach for `<Feedback>` + `<Feedback.Trigger>` directly when you
 * need controlled open state, multiple triggers, or no trigger at all.
 */
export type FeedbackButtonProps = Omit<FeedbackRootProps, "children"> &
  FeedbackTriggerProps;

export const FeedbackButton = React.forwardRef<
  HTMLButtonElement,
  FeedbackButtonProps
>(function FeedbackButton(
  {
    platformId,
    url,
    widget,
    theme,
    tokens,
    open,
    defaultOpen,
    onOpenChange,
    side,
    align,
    width,
    ...triggerProps
  },
  ref,
) {
  return (
    <Feedback
      platformId={platformId}
      url={url}
      widget={widget}
      theme={theme}
      tokens={tokens}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      side={side}
      align={align}
      width={width}
    >
      <FeedbackTrigger ref={ref} {...triggerProps} />
    </Feedback>
  );
});

FeedbackButton.displayName = "FeedbackButton";
```

- [ ] **Step 6: Update `src/index.ts`**

```ts
export { Feedback } from "./Feedback";
export { FeedbackTrigger } from "./FeedbackTrigger";
export { FeedbackButton } from "./FeedbackButton";
export { useFeedback } from "./context";

export type { FeedbackRootProps } from "./Feedback";
export type {
  FeedbackTriggerProps,
  FeedbackVariant,
  FeedbackSize,
  FeedbackShape,
  FeedbackPlacement,
} from "./FeedbackTrigger";
export type { FeedbackButtonProps } from "./FeedbackButton";
export type { FeedbackContextValue, FeedbackTriggerMode } from "./context";
export type { FeedbackToken, FeedbackTokens } from "./lib/tokens";
export type { FeedbackTheme, FeedbackThemeOption } from "./hooks/use-theme";
```

- [ ] **Step 7: Build and verify**

Run: `npm run build -w feedbackland-react`
Expected: PASS. The old `FeedbackButton` discriminated union is gone; if anything still imports `StyledVariant` or the removed `Variant`/`Size` aliases from `FeedbackButton`, it fails here.

- [ ] **Step 8: Manual check — every tier**

Run: `npm run dev -w feedbackland-react`

Temporarily edit `src/main.tsx` to render each of these and confirm:

1. `<FeedbackButton platformId={platformId} />` — a solid "Feedback" button with **no icon**, visually identical to 2.x. Opens the drawer.
2. `<FeedbackButton platformId={platformId} size="icon" />` — a 36px square with the speech-bubble glyph. Inspect it: `aria-label="Feedback"` is present.
3. `<FeedbackButton platformId={platformId} size="icon-lg" shape="pill" placement="bottom-right" />` — a circular button pinned 1.5rem from the bottom-right of the viewport. Open the drawer and confirm the panel covers it.
4. `<FeedbackButton platformId={platformId} widget="popover" variant="outline" />` — opens anchored; **click the trigger again and confirm it closes**. This is the regression the `ownsClick` branch exists to prevent.
5. `<FeedbackButton platformId={platformId} id="fb" data-testid="x" title="Send feedback" />` — inspect and confirm all three land on the `<button>` element, and that there is **no wrapper `<div class="fl-scope">`** — the button itself carries `fl-scope`.
6. A controlled root:

```tsx
function Controlled() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open from outside</button>
      <Feedback platformId={platformId} open={open} onOpenChange={setOpen} />
    </>
  );
}
```

Confirm the drawer opens with no trigger of its own rendered, and that closing it via Escape sets `open` back to `false`.

Revert `src/main.tsx` afterwards — Task 6 rewrites it properly.

- [ ] **Step 9: Commit**

```bash
git add feedbackland-react/src
git commit -m "feat(feedbackland-react)!: compound Feedback/Feedback.Trigger API

BREAKING CHANGE: the fl-scope wrapper div is gone (fl-scope now sits on the
button), icon sizes render a glyph instead of the text string, className
applies under asChild, and the dark variant resolves by class."
```

---

### Task 5: Root typecheck and app build

The admin app consumes the package. This task exists as its own gate because it is the first point where the rebuilt `dist/` meets the Next app, and the failure mode is different from a package build failure.

**Files:**
- Modify: `components/app/widget-docs/index.tsx` (only if the typecheck demands it)

**Interfaces:**
- Consumes: `FeedbackButton` and its new `FeedbackButtonProps` from Task 4.
- Produces: a green root build.

- [ ] **Step 1: Rebuild the package so the workspace symlink serves fresh `dist/`**

Run: `npm run build -w feedbackland-react`
Expected: PASS.

- [ ] **Step 2: Typecheck the root app**

Run: `npx tsc --noEmit`
Expected: PASS with no output. If `components/app/widget-docs/index.tsx:241-249` errors, it will be because `Variant`/`Size` from `lib/widget-snippets.ts` no longer structurally match the trigger's unions — leave the playground's own types alone and fix by widening them in Task 7, or add the missing union member if one was genuinely dropped.

- [ ] **Step 3: Build the app**

Run: `npx next build`
Expected: PASS. Compiles successfully and the `/[orgSubdomain]/(board)/admin/widget` route is listed in the route table.

- [ ] **Step 4: Commit if anything changed**

```bash
git add -A
git commit -m "fix: reconcile admin widget page with the 3.0 trigger types"
```

If nothing changed, skip the commit and note the gate passed clean.

---

### Task 6: Dev matrix harness

**Files:**
- Modify: `feedbackland-react/src/main.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Feedback`, `FeedbackButton`, `useFeedback` from Task 4.
- Produces: nothing consumed by later tasks — this is a verification vehicle.

- [ ] **Step 1: Rewrite `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Feedback, FeedbackButton, useFeedback } from "./index";

const platformId = "987637fb-7ca1-4bd6-b608-cc416db75788";

const VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
] as const;

const TEXT_SIZES = ["sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-sm", "icon", "icon-lg"] as const;
const SHAPES = ["default", "pill", "square"] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

/** Headless tier — must live in a child component, not inline in the JSX
 *  passed to <Feedback>, or the provider is not yet in scope. */
function HeadlessTrigger() {
  const { triggerProps, isOpen } = useFeedback();
  return (
    <button {...triggerProps} style={{ padding: "8px 16px" }}>
      Headless ({isOpen ? "open" : "closed"})
    </button>
  );
}

function Harness() {
  const [controlled, setControlled] = React.useState(false);

  return (
    <div style={{ padding: 32, fontFamily: "system-ui" }}>
      {VARIANTS.map((variant) => (
        <Row key={variant} label={`variant="${variant}" — text sizes`}>
          {TEXT_SIZES.map((size) => (
            <FeedbackButton
              key={size}
              platformId={platformId}
              variant={variant}
              size={size}
            />
          ))}
          {TEXT_SIZES.map((size) => (
            <FeedbackButton
              key={`${size}-icon`}
              platformId={platformId}
              variant={variant}
              size={size}
              icon
            />
          ))}
        </Row>
      ))}

      {SHAPES.map((shape) => (
        <Row key={shape} label={`shape="${shape}" — icon sizes`}>
          {ICON_SIZES.map((size) => (
            <FeedbackButton
              key={size}
              platformId={platformId}
              size={size}
              shape={shape}
              variant="outline"
            />
          ))}
        </Row>
      ))}

      <Row label="unstyled + asChild">
        <FeedbackButton
          platformId={platformId}
          variant="unstyled"
          className="my-own-button"
        />
        <FeedbackButton platformId={platformId} asChild>
          <button style={{ border: "2px dashed hotpink", padding: 8 }}>
            Bring your own
          </button>
        </FeedbackButton>
      </Row>

      <Row label="popover flavour">
        <FeedbackButton platformId={platformId} widget="popover" />
        <FeedbackButton
          platformId={platformId}
          widget="popover"
          side="top"
          align="start"
          width={320}
          variant="outline"
        />
      </Row>

      <Row label="tokens + forced theme">
        <FeedbackButton
          platformId={platformId}
          tokens={{ primary: "#6d28d9", primaryForeground: "#ffffff" }}
        />
        <FeedbackButton platformId={platformId} theme="dark" variant="outline" />
        <FeedbackButton platformId={platformId} theme="light" variant="outline" />
      </Row>

      <Row label="headless + controlled">
        <Feedback platformId={platformId}>
          <HeadlessTrigger />
        </Feedback>
        <button onClick={() => setControlled(true)}>Open from outside</button>
        <Feedback
          platformId={platformId}
          open={controlled}
          onOpenChange={setControlled}
        />
      </Row>

      <FeedbackButton
        platformId={platformId}
        size="icon-lg"
        shape="pill"
        placement="bottom-right"
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Run the harness**

Run: `npm run dev -w feedbackland-react`

Expected, checked in order:

- Every text-size button reads "Feedback"; the second group of three in each variant row shows the speech bubble to the **left** of the label.
- Every icon-size button is a square (or circle under `shape="pill"`) containing only the glyph — **no overflowing text**. This is gap #2 fixed.
- `theme="dark"` and `theme="light"` outline buttons look different from each other regardless of your OS setting, and toggling `<html class="dark">` in devtools does not change either of them.
- The `tokens` button is purple.
- The headless button's label flips to "(open)" while the drawer is open.
- The floating circle sits at the bottom-right of the viewport; opening the drawer covers it.

- [ ] **Step 3: Commit**

```bash
git add feedbackland-react/src/main.tsx
git commit -m "chore(feedbackland-react): dev harness rendering the full trigger matrix"
```

---

### Task 7: Presets and the snippet generator

**Files:**
- Create: `lib/widget-presets.ts`
- Modify: `lib/widget-snippets.ts` (full rewrite)

**Interfaces:**
- Consumes: the prop names and defaults from Task 4's `FeedbackTriggerProps`.
- Produces: `WIDGET_PRESETS`, `WidgetPreset`, `PresetGroup`, `PRESET_GROUPS`, `Shape`, `Placement`, and a `buildPlaygroundSnippet` that accepts `shape`, `placement`, `icon`, `iconPosition`, `theme`.

- [ ] **Step 1: Rewrite `lib/widget-snippets.ts`**

```ts
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

export type Size = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

export type Shape = "default" | "pill" | "square";

export type Placement =
  | "inline"
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type Theme = "auto" | "light" | "dark";

export type IconPosition = "start" | "end";

export type WidgetSnippetConfig = {
  orgId: string;
  url?: string;
  widget: Widget;
  text: string;
  variant: Variant;
  size: Size;
  shape: Shape;
  placement: Placement;
  theme: Theme;
  icon: boolean;
  iconPosition: IconPosition;
  className: string;
};

const TEXT_DEFAULT = "Feedback";
const VARIANT_DEFAULT: Variant = "default";
const SIZE_DEFAULT: Size = "default";
const SHAPE_DEFAULT: Shape = "default";
const PLACEMENT_DEFAULT: Placement = "inline";
const THEME_DEFAULT: Theme = "auto";
const ICON_POSITION_DEFAULT: IconPosition = "start";
const WIDGET_DEFAULT: Widget = "drawer";

const ICON_SIZES: ReadonlySet<Size> = new Set(["icon", "icon-sm", "icon-lg"]);

/** Render a JSX attribute value — JSON.stringify handles embedded quotes. */
function jsxStr(value: string): string {
  return JSON.stringify(value);
}

export function buildPlaygroundSnippet(c: WidgetSnippetConfig): string {
  const isIconSize = ICON_SIZES.has(c.size);

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
  if (c.shape !== SHAPE_DEFAULT) lines.push(`      shape=${jsxStr(c.shape)}`);
  if (c.placement !== PLACEMENT_DEFAULT)
    lines.push(`      placement=${jsxStr(c.placement)}`);
  if (c.theme !== THEME_DEFAULT) lines.push(`      theme=${jsxStr(c.theme)}`);

  // Icon sizes render the built-in glyph with no prop at all, so `icon` is only
  // worth emitting when it changes the outcome: on for a text size, off for an
  // icon size. Bare `icon` keeps the snippet import-free.
  if (c.icon && !isIconSize) lines.push(`      icon`);
  if (!c.icon && isIconSize) lines.push(`      icon={false}`);
  if (c.icon && !isIconSize && c.iconPosition !== ICON_POSITION_DEFAULT)
    lines.push(`      iconPosition=${jsxStr(c.iconPosition)}`);

  if (c.className) lines.push(`      className=${jsxStr(c.className)}`);

  lines.push(`    />`);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join("\n");
}
```

- [ ] **Step 2: Create `lib/widget-presets.ts`**

```ts
/**
 * The curated default looks surfaced in the admin Widget page and the package
 * README. Deliberately data, not a runtime `preset` prop — `variant`, `size`,
 * `shape` and `placement` already express every one of these, and a preset
 * prop would only add conflict semantics on top.
 */

import type {
  IconPosition,
  Placement,
  Shape,
  Size,
  Variant,
} from "./widget-snippets";

export const PRESET_GROUPS = ["Text", "Icon", "Floating"] as const;

export type PresetGroup = (typeof PRESET_GROUPS)[number];

export type WidgetPresetConfig = {
  variant: Variant;
  size: Size;
  shape: Shape;
  placement: Placement;
  icon: boolean;
  iconPosition: IconPosition;
  className: string;
};

export type WidgetPreset = {
  id: string;
  label: string;
  group: PresetGroup;
  config: WidgetPresetConfig;
};

/** Everything a preset does not explicitly change. */
const BASE: WidgetPresetConfig = {
  variant: "default",
  size: "default",
  shape: "default",
  placement: "inline",
  icon: false,
  iconPosition: "start",
  className: "",
};

function preset(
  id: string,
  label: string,
  group: PresetGroup,
  config: Partial<WidgetPresetConfig>,
): WidgetPreset {
  return { id, label, group, config: { ...BASE, ...config } };
}

export const WIDGET_PRESETS: WidgetPreset[] = [
  preset("primary", "Primary", "Text", {}),
  preset("primary-sm", "Primary small", "Text", { size: "sm" }),
  preset("primary-lg", "Primary large", "Text", { size: "lg" }),
  preset("primary-icon", "With icon", "Text", { icon: true }),
  preset("outline", "Outline", "Text", { variant: "outline", icon: true }),
  preset("ghost", "Subtle", "Text", { variant: "ghost", icon: true }),
  preset("pill", "Pill", "Text", { shape: "pill", icon: true }),
  preset("link", "Inline link", "Text", { variant: "link" }),

  preset("icon-sm", "Icon small", "Icon", {
    variant: "outline",
    size: "icon-sm",
  }),
  preset("icon", "Icon", "Icon", { size: "icon" }),
  preset("icon-lg", "Icon large", "Icon", {
    variant: "secondary",
    size: "icon-lg",
  }),
  preset("icon-circle", "Icon circle", "Icon", {
    variant: "outline",
    size: "icon",
    shape: "pill",
  }),

  preset("floating-pill", "Floating pill", "Floating", {
    size: "lg",
    shape: "pill",
    placement: "bottom-right",
    icon: true,
  }),
  preset("floating-circle", "Floating circle", "Floating", {
    size: "icon-lg",
    shape: "pill",
    placement: "bottom-right",
  }),
];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL, in `components/app/widget-docs/index.tsx` only — `buildPlaygroundSnippet` now requires `shape`, `placement`, `theme`, `icon` and `iconPosition`, which the playground does not yet pass. This is the expected intermediate state; Task 8 resolves it. Confirm there are **no** errors in `lib/widget-presets.ts` or `lib/widget-snippets.ts` themselves.

- [ ] **Step 4: Commit**

```bash
git add lib/widget-presets.ts lib/widget-snippets.ts
git commit -m "feat(widget-docs): add preset catalogue and extend the snippet generator"
```

---

### Task 8: The playground gallery

**Files:**
- Modify: `components/app/widget-docs/index.tsx` (substantial rewrite of the config panel and preview)

**Interfaces:**
- Consumes: `WIDGET_PRESETS`, `PRESET_GROUPS`, `WidgetPreset` from Task 7; `buildPlaygroundSnippet` with its widened config; `FeedbackButton` from Task 4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the new state and option lists**

In `components/app/widget-docs/index.tsx`, extend the imports and the option constants above `WidgetDocs`:

```tsx
import {
  buildPlaygroundSnippet,
  type Variant,
  type Size,
  type Shape,
  type Placement,
  type Widget,
} from "@/lib/widget-snippets";
import {
  WIDGET_PRESETS,
  PRESET_GROUPS,
  type WidgetPreset,
} from "@/lib/widget-presets";

const SHAPE_OPTIONS: { value: Shape; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
];

const PLACEMENT_OPTIONS: { value: Placement; label: string }[] = [
  { value: "inline", label: "Inline" },
  { value: "bottom-right", label: "Floating — bottom right" },
  { value: "bottom-left", label: "Floating — bottom left" },
  { value: "top-right", label: "Floating — top right" },
  { value: "top-left", label: "Floating — top left" },
];
```

Add the state next to the existing `useState` calls at lines 64-68:

```tsx
  const [shape, setShape] = useState<Shape>("default");
  const [placement, setPlacement] = useState<Placement>("inline");
  const [icon, setIcon] = useState(false);
  const [presetId, setPresetId] = useState<string | null>("primary");
```

- [ ] **Step 2: Add the preset applier**

```tsx
  const applyPreset = (p: WidgetPreset) => {
    setPresetId(p.id);
    setVariant(p.config.variant);
    setSize(p.config.size);
    setShape(p.config.shape);
    setPlacement(p.config.placement);
    setIcon(p.config.icon);
    setClassName(p.config.className);
  };
```

Every individual control must clear the preset highlight, since the config no longer matches the named preset. Wrap each existing setter at its call site, e.g. the variant `Select`:

```tsx
                onValueChange={(v) => {
                  setPresetId(null);
                  setVariant(v as Variant);
                }}
```

Do the same for `size`, `shape`, `placement`, `icon`, `text` and `className`.

- [ ] **Step 3: Feed the new config into the snippet**

Update the `useMemo` at lines 99-111:

```tsx
  const snippet = useMemo(
    () =>
      buildPlaygroundSnippet({
        orgId,
        url: snippetUrl,
        widget,
        text,
        variant,
        size,
        shape,
        placement,
        theme: "auto",
        icon,
        iconPosition: "start",
        className,
      }),
    [
      orgId,
      snippetUrl,
      widget,
      text,
      variant,
      size,
      shape,
      placement,
      icon,
      className,
    ],
  );
```

`theme` and `iconPosition` are fixed at their defaults here — they are documented props rather than playground controls, and pinning them keeps the generated snippet free of noise.

- [ ] **Step 4: Render the gallery above the controls**

Insert this as the first child of `<CardContent>` (before the Widget field at line 125):

```tsx
            <div className="space-y-3">
              <Label>Presets</Label>
              {PRESET_GROUPS.map((group) => (
                <div key={group} className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WIDGET_PRESETS.filter((p) => p.group === group).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        aria-pressed={presetId === p.id}
                        className={
                          presetId === p.id
                            ? "border-foreground bg-muted/60 rounded-md border px-2 py-1 text-xs"
                            : "border-border hover:bg-muted/40 rounded-md border px-2 py-1 text-xs"
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
```

- [ ] **Step 5: Add the Shape and Placement controls**

Insert after the existing Size field (after line 196), following the same `Field` + `Select` shape already used for variant and size:

```tsx
            <Field label="Shape" hint="Corner radius preset" htmlFor="widget-shape">
              <Select
                value={shape}
                onValueChange={(v) => {
                  setPresetId(null);
                  setShape(v as Shape);
                }}
              >
                <SelectTrigger id="widget-shape">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHAPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Placement"
              hint="Inline, or pinned to a viewport corner"
              htmlFor="widget-placement"
            >
              <Select
                value={placement}
                onValueChange={(v) => {
                  setPresetId(null);
                  setPlacement(v as Placement);
                }}
              >
                <SelectTrigger id="widget-placement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLACEMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
```

- [ ] **Step 6: Add the Icon toggle**

Insert after the Label field (after line 152), reusing the existing `Tabs` pattern from the Widget field:

```tsx
            <Field
              label="Icon"
              hint="Icon sizes always show it; text sizes are opt-in"
              htmlFor="widget-icon"
            >
              <Tabs
                value={icon ? "on" : "off"}
                onValueChange={(v) => {
                  setPresetId(null);
                  setIcon(v === "on");
                }}
              >
                <TabsList id="widget-icon" className="grid w-full grid-cols-2">
                  <TabsTrigger value="off">No icon</TabsTrigger>
                  <TabsTrigger value="on">With icon</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
```

- [ ] **Step 7: Contain the floating preview**

A `placement` other than `inline` renders `position: fixed`, which would otherwise pin the preview button to the corner of the whole admin page. A `transform` on an ancestor creates a containing block for fixed descendants, so the FAB lands in the corner of the preview box instead.

Replace the preview container at line 240:

```tsx
          <div className="relative flex min-h-[220px] w-full items-center justify-center px-4 py-8 [transform:translateZ(0)]">
```

and pass the new props to the preview button at lines 241-249:

```tsx
            <FeedbackButton
              platformId={orgId}
              url={previewUrl}
              widget={widget}
              text={text || "Feedback"}
              variant={variant}
              size={size}
              shape={shape}
              placement={placement}
              icon={icon}
              className={className || undefined}
            />
```

- [ ] **Step 8: Typecheck and build**

Run: `npm run build -w feedbackland-react && npx tsc --noEmit && npx next build`
Expected: all three PASS. The `tsc --noEmit` failure introduced in Task 7 Step 3 is now resolved.

- [ ] **Step 9: Manual check — the gallery**

Run: `npm run widget-dev`, then open the admin Widget page for your org.

Expected:

- Three preset groups render: Text (8), Icon (4), Floating (2).
- Clicking "Icon circle" makes the preview a circular outline button with the glyph, and the snippet shows `size="icon"` plus `shape="pill"` and **no** `icon` prop.
- Clicking "With icon" (Text group) shows the glyph beside the label, and the snippet contains a bare `icon` line with no lucide import.
- Clicking "Floating circle" pins the preview button to the bottom-right **of the preview box**, not the page.
- Changing any Select clears the highlighted preset.

- [ ] **Step 10: Commit**

```bash
git add components/app/widget-docs/index.tsx
git commit -m "feat(widget-docs): preset gallery plus shape, placement and icon controls"
```

---

### Task 9: Documentation and the 3.0.0 release

**Files:**
- Modify: `feedbackland-react/README.md` (props table, styling section, migration)
- Modify: `README.md:87-107` (widget section)
- Modify: `package.json:15` (`release:react` script)
- Modify: `feedbackland-react/package.json` (version, via npm)

**Interfaces:**
- Consumes: the final API from Tasks 4 and 7.
- Produces: nothing.

- [ ] **Step 1: Rewrite the package README's "Style it your way" section**

Replace the four numbered tiers at `feedbackland-react/README.md:62-101` with the three-tier compound story plus the preset gallery. Cover, in order: the one-liner; `variant`/`size`/`shape`/`icon`/`placement` with the 14 presets as a copyable table mirroring `lib/widget-presets.ts`; `className`; `variant="unstyled"`; `asChild`; `tokens`; the compound `<Feedback>` form with controlled `open`; and `useFeedback()` with the child-component caveat spelled out.

- [ ] **Step 2: Replace the props table**

`feedbackland-react/README.md:105-115` must become two tables — root props and trigger props — matching the spec's tables exactly. State that the trigger extends `ComponentProps<"button">` and forwards refs, and that `FeedbackButton` accepts both sets.

- [ ] **Step 3: Add a migration section**

A `## Upgrading from 2.x` section listing the four breaking changes verbatim from the spec: the removed `fl-scope` wrapper, icon sizes rendering the glyph, the dark variant resolving by class, and `className` now applying under `asChild`. Lead with the fact that `<FeedbackButton platformId="…" />` needs no changes.

- [ ] **Step 4: Update the root README**

At `README.md:87-107`, keep the one-liner as the headline but add a single line noting icon and floating variants and the compound API, linking to the package README. Do not expand it into a second props table — the root README deliberately stays short.

- [ ] **Step 5: Fix the release script**

`package.json:15`:

```json
    "release:react": "npm version major -w feedbackland-react && npm publish -w feedbackland-react",
```

Note in the commit message that this should go back to `patch` after 3.0.0 ships.

- [ ] **Step 6: Bump the version**

Run: `npm version major -w feedbackland-react --no-git-tag-version`
Expected: `feedbackland-react/package.json` version becomes `3.0.0`.

- [ ] **Step 7: Final full verification**

Run: `npm run build -w feedbackland-react && npx tsc --noEmit && npx next build`
Expected: all three PASS.

- [ ] **Step 8: Commit**

```bash
git add README.md feedbackland-react/README.md package.json feedbackland-react/package.json
git commit -m "docs(feedbackland-react): document the 3.0 trigger API and bump to 3.0.0"
```

---

## Self-review notes

Checked against the spec:

- Spec coverage: gaps #1-#10 all map to a task (#1, #2, #3, #5 → Task 4; #4 → Task 4 Step 3's warning; #6, #8, #9 → Task 4 Step 4; #7 → Task 2; #10 → Task 3 Step 4). Root props, trigger props, presets, playground, harness, migration and the version bump each have a task.
- Type consistency: `open`/`onOpenChange`/`isDesktop`/`side`/`align`/`width` as introduced on the widgets in Task 3 are consumed with the same names in Task 4 Step 4. `themeClass` is produced in Task 1's `FeedbackContextValue`, set in Task 4 Step 4, read in Task 4 Step 3. `Shape` and `Placement` are exported from `lib/widget-snippets.ts` in Task 7 Step 1 and imported from there in both Task 7 Step 2 and Task 8 Step 1.
- One deliberate red state: Task 7 Step 3 expects `tsc --noEmit` to fail in the playground, resolved by Task 8 Step 8. It is called out at both ends so it cannot be mistaken for a regression.
