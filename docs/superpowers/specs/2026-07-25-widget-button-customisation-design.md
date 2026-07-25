# Widget Button Customisation — Design

**Date:** 2026-07-25
**Status:** Approved
**Author:** Claude (with David)
**Package:** `feedbackland-react` — major bump to **3.0.0**

## Goal

Make the widget's trigger button maximally customisable — any style, any shape,
any position, any DOM attribute, opened from anywhere — while shipping defaults
good enough that a user who customises nothing still gets a well-made button,
and a varied menu of ready-made looks (text and icon, several sizes) they can
pick from without designing anything themselves.

## Non-goals

- A vanilla-JS / `<script>` embed. This is React-package-only.
- Changing the two widget flavours (drawer / popover) or the board itself.
- A theming DSL. `tokens` sets CSS custom properties; that is the whole surface.
- Animation / motion presets for the trigger.

## Deep-dive: what exists today

`FeedbackButton` (`feedbackland-react/src/FeedbackButton.tsx:23-49`) accepts
exactly `platformId`, `url`, `widget`, `text`, `variant` (7 values), `size`
(6 values), `className`, `asChild` + `children`. Four styling tiers: preset →
`className` merge → `variant="unstyled"` → `asChild`.

`cn()` (`src/lib/utils.ts:7`) strips the `fl:` prefix before handing classes to
`twMerge`, so host classes genuinely win conflicts against widget defaults. That
part works as documented and is left alone.

### Gaps found

| # | Gap | Evidence |
|---|---|---|
| 1 | Closed prop type, no ref. No `id`, `aria-label`, `title`, `data-*`, `style`, `onClick`, `disabled`, `type`, `tabIndex`. Internal `Button` supports `loading`/`disabled` but they're unreachable. | `FeedbackButton.tsx:23-49`, `components/ui/button.tsx:44` |
| 2 | Icon sizes exist but there is no icon. `size="icon*"` renders a 32/36/40px square while `content = children ?? text` still defaults to the string `"Feedback"` under `fl:whitespace-nowrap`. Three of six sizes are unusable. No `icon` prop, no default glyph, no leading/trailing icon for text buttons. | `FeedbackButton.tsx:77`, `button.tsx:28-30` |
| 3 | `className` silently dropped under `asChild` — only the unstyled and default branches consume it. | `FeedbackButton.tsx:90,97` |
| 4 | `size` silently ignored when `variant="unstyled"`. | `FeedbackButton.tsx:89-93` |
| 5 | Block-level `<div className="fl-scope">` wrapper takes no className/style. Can't sit inline in prose, can't be a controlled grid/flex item. | `FeedbackButton.tsx:121` |
| 6 | No `theme` prop, though `useTheme` already implements `"light" \| "dark" \| "auto"`. Both widgets call it bare. | `hooks/use-theme.ts:24`, `OverlayWidget.tsx:122`, `PopoverWidget.tsx:67` |
| 7 | Dark-mode mismatch. `--fl-*` flip on `html.dark`, but there is no `@custom-variant dark`, so `fl:dark:*` utilities resolve via `prefers-color-scheme`. Class-based-dark host + light OS = light utilities over dark tokens. The `cn({ dark: isDarkMode })` classes match no CSS rule and are dead. | `index.css:487`, `OverlayWidget.tsx:294`, `PopoverWidget.tsx:290,294` |
| 8 | `--fl-*` token overrides work but are undocumented and unexposed. | `index.css:452-485` |
| 9 | No controlled or programmatic open. Each widget owns private open state. | `OverlayWidget.tsx:107`, `PopoverWidget.tsx:65` |
| 10 | No popover geometry control; width hardcoded. | `PopoverWidget.tsx:294` |

Anything added must also land in `lib/widget-snippets.ts` and
`components/app/widget-docs/index.tsx`, which mirror the prop list exactly.

## Architecture — compound components

Chosen over widening the flat component (prop namespace collapses widget config
into trigger appearance; button-less opening becomes a hide-the-button hack) and
over headless-first (inverts the drop-in value proposition).

### File layout

| File | Role |
|---|---|
| `src/Feedback.tsx` | Root. Owns open state, resolves theme + tokens, renders the widget shell and provides context. |
| `src/FeedbackTrigger.tsx` | The button. Extends `ComponentProps<"button">`, `forwardRef`. |
| `src/FeedbackButton.tsx` | Thin collapse of Root + Trigger — the one-liner. |
| `src/context.tsx` | `FeedbackContext`, `useFeedback()`. |
| `src/OverlayWidget.tsx` | Presentation only; open state lifted out to Root. |
| `src/PopoverWidget.tsx` | Presentation only; open state lifted out to Root. |
| `src/components/ui/button.tsx` | CVA gains `shape`; icon slots added. |
| `src/index.css` | `@custom-variant dark`; dark var block gains the class selector. |

### The state lift

The core structural change. `OverlayWidget.tsx:107` and `PopoverWidget.tsx:65`
each own a private `useState` for open. Root takes it over via a controllable
state hook (`open` / `defaultOpen` / `onOpenChange`); the widgets become dumb
renderers driven by props. Nothing else makes controlled or programmatic
opening possible.

### Three tiers, one engine

```tsx
// 1. Drop-in — visually unchanged from 2.x
<FeedbackButton platformId="…" />

// 2. Compound — full control
<Feedback platformId="…" widget="popover" theme="auto" open={o} onOpenChange={setO}>
  <Feedback.Trigger variant="outline" size="lg" icon={<MessageSquare />} />
</Feedback>

// 3. Headless — your own element, or none at all
function MyTrigger() {
  const { triggerProps, isOpen } = useFeedback();
  return <MyOwnThing {...triggerProps} data-open={isOpen} />;
}

<Feedback platformId="…" open={o} onOpenChange={setO}>
  <MyTrigger />
</Feedback>
```

`useFeedback()` returns `{ isOpen, open, close, toggle, triggerProps }` and
throws outside a `Feedback` root. It must be called from a **child component**,
not inline in the JSX passed to `Feedback` — children are evaluated in the
parent's scope, where the provider is not yet in effect.

`FeedbackButton` accepts the **union** of Root and Trigger props and routes each
to the right place. The compound form is therefore only needed for controlled
open, multiple triggers, or headless usage.

### Wiring details

`Trigger` reads `triggerMode` from context and wraps itself in Radix
`PopoverTrigger` / `DrawerTrigger` / a plain `onClick` accordingly. This
preserves the `aria-haspopup`, `aria-expanded` and `aria-controls` those
triggers provide — a bare `PopoverAnchor` would have dropped them.

A `Feedback` root with **no** `Trigger` is valid and is how button-less usage
works. In `widget="popover"` mode there is then nothing to anchor to, so it
renders as the bottom-sheet Drawer — the mobile path already at
`PopoverWidget.tsx:272`, reused rather than invented.

`onClick` **composes**: the consumer's handler runs first and the widget opens
unless `preventDefault()` was called (Radix convention).

## Trigger props

Extends `ComponentProps<"button">` — `id`, `style`, `data-*`, `title`,
`disabled`, `tabIndex`, `onFocus` and the rest pass through. `forwardRef`,
because React 17/18 are in the peer range and cannot use ref-as-prop.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `text` | `string` | `"Feedback"` | Visible label on text sizes; becomes `aria-label` on icon sizes |
| `icon` | `boolean \| ReactNode` | size-dependent | `true`/bare → built-in glyph; element → yours; `false` → none |
| `iconPosition` | `"start" \| "end"` | `"start"` | |
| `variant` | `"default" \| "secondary" \| "outline" \| "ghost" \| "link" \| "destructive" \| "unstyled"` | `"default"` | unchanged |
| `size` | `"default" \| "sm" \| "lg" \| "icon" \| "icon-sm" \| "icon-lg"` | `"default"` | unchanged |
| `shape` | `"default" \| "pill" \| "square"` | `"default"` | `pill` on an icon size *is* a circle — no separate value |
| `placement` | `"inline" \| "bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"inline"` | Non-inline = `position: fixed` at `z-index: 2147483640` — above typical host chrome, below the backdrop (`2147483646`) and panel (`2147483647`) so an open drawer still covers the FAB |
| `offset` | `number \| string` | `"1.5rem"` | Inset for fixed placements; number = px |
| `asChild` | `boolean` | `false` | Now also merges `className` into the child (fixes #3) |
| `className` | `ClassValue` | — | unchanged semantics |

### The size-dependent `icon` default

Deliberate, and it is what makes both halves of the goal work at once:

- On `size="default" | "sm" | "lg"`, omitting `icon` means **no icon**. So
  `<FeedbackButton platformId="…" />` is pixel-identical to 2.x.
- On `size="icon" | "icon-sm" | "icon-lg"`, omitting `icon` yields the built-in
  glyph and `text` moves to `aria-label`.

Three broken sizes become working ones, and an icon-only button can never ship
without an accessible name. `aria-label` passed explicitly always wins.

Built-in glyph: lucide `MessageSquare`. Neutral speech bubble; `lucide-react` is
already a dependency (`OverlayWidget` and `PopoverWidget` import from it), so
the marginal bundle cost is one tree-shaken icon.

## Root props

Existing: `platformId`, `url`, `widget`. Added:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | Wires the already-written `useTheme(option)` at `hooks/use-theme.ts:24` |
| `tokens` | `Partial<Record<FeedbackToken, string>>` | — | Applied as inline `--fl-*` custom properties to both the trigger and the portaled panel. Rebrands everything without writing Tailwind. |
| `open` / `defaultOpen` / `onOpenChange` | controllable state | uncontrolled | |
| `side` / `align` / `width` | popover geometry | `bottom` / `center` / `400px` | Replaces the hardcoded `fl:w-[400px]` at `PopoverWidget.tsx:294` |

Root resolves `tokens` into a style object and threads it through context;
`Trigger` merges it into the button's `style`, the panels into theirs.

## Structural fixes

### The wrapper disappears

`<div className="fl-scope">` is removed. `fl-scope` moves onto the button
element itself, so the trigger is a single DOM node with no layout-participating
parent: it can sit inline in a sentence, be a direct grid child, or be
`position: fixed` for the floating placements.

Not applied under `asChild` or `variant="unstyled"` — those deliberately live in
the host's typographic and box-model context, as today.

Placement utilities (`fl:fixed`, insets) are ordinary global Tailwind classes and
do not require the scope, so floating placement works in every styling tier.

### Dark mode gets one source of truth

`index.css` gains:

```css
@custom-variant dark (&:where(.fl-dark, .fl-dark *, html.dark *));
```

and the dark variable block becomes `.fl-scope.fl-dark, html.dark .fl-scope`.

Utilities and variables then agree in both the host-class case and the
forced-`theme` case, closing gap #7. The currently-dead `cn({ dark: isDarkMode })`
classes become the real `fl-dark` and start doing work. Matching `html.dark *` in
the variant as well as the class means there is no pre-hydration divergence
window: the CSS-driven and JS-driven paths resolve identically.

### `variant="unstyled"` honesty

`size` and `shape` still do not apply under `unstyled` — that is what unstyled
means. But a dev-time `console.warn` fires when they are passed together, so the
behaviour stops being silent (gap #4).

`loading` stays internal. The trigger has no async action of its own, so
exposing it would be a prop that means nothing.

## Defaults: a preset gallery, not a `preset` prop

The primitives now span 7 variants × 6 sizes × 3 shapes × 5 placements. That is
flexibility, not defaults — nobody discovers that
`size="icon-lg" shape="pill" placement="bottom-right"` is a floating circular
FAB by reading a props table.

A `preset` prop is rejected: it would be a third way to express what
`variant`/`size`/`shape` already express, and would need conflict semantics
(`preset="fab"` plus `size="sm"` — who wins?). The gap is discovery, not
expressiveness.

Defaults ship instead as a **preset gallery** in the admin Widget page, above
the existing controls. Clicking a preset sets the controls; every control
remains tweakable afterwards and the snippet updates live. Discovery plus
refinement, zero new runtime API.

Presets live as a pure `WIDGET_PRESETS` array in `lib/widget-presets.ts`,
matching the existing pure-function style of `lib/widget-snippets.ts`. The same
set becomes the README's "Style it your way" section.

Three rows, 14 entries:

**Text** — Primary · Primary small · Primary large · With icon · Outline ·
Subtle (ghost) · Pill · Inline link
**Icon** — Icon small (outline) · Icon (primary) · Icon large (secondary) ·
Icon circle (outline)
**Floating** — Floating pill (bottom-right, `lg`, icon + text) · Floating circle
(bottom-right, `icon-lg`)

Because `icon` bare means the built-in glyph, an icon preset emits
`<FeedbackButton platformId="…" size="icon" icon />`. The user copies it and it
works, with no lucide dependency added to their app.

`buildPlaygroundSnippet` stays a single-shape generator emitting the one-liner —
`FeedbackButton` takes the union of Root and Trigger props, and the playground
exercises nothing that requires the compound form.

`src/main.tsx` becomes a dev harness rendering the full variant × size × shape
matrix, so regressions are visible at a glance instead of one combination at a
time.

## Breaking changes (3.0.0)

1. The `<div className="fl-scope">` wrapper is gone; `fl-scope` moves onto the
   button. Anyone targeting `.fl-scope > button` or depending on the wrapper's
   block layout is affected.
2. `size="icon" | "icon-sm" | "icon-lg"` render the glyph instead of the `text`
   string. Passing `children` still wins, so only the previously-broken case
   changes.
3. The `dark` variant resolves by class rather than `prefers-color-scheme`. In a
   class-based-dark host with a light OS, `outline` / `ghost` / `destructive`
   will look different — correct, but different.
4. `className` now applies under `asChild` instead of being silently dropped.

Everything else is additive: DOM passthrough, `ref`, `icon`, `iconPosition`,
`shape`, `placement`, `offset`, `theme`, `tokens`, `side` / `align` / `width`,
controlled `open`, `useFeedback()`.

## Gap → fix map

| Gap | Fixed by |
|---|---|
| 1 | `ComponentProps<"button">` passthrough + `forwardRef` on Trigger |
| 2 | `icon` prop, `MessageSquare` default, size-dependent default rule |
| 3 | `className` merged into the child via `Slot` under `asChild` |
| 4 | Dev warning when `size`/`shape` meet `variant="unstyled"` |
| 5 | Wrapper removed; `fl-scope` on the button |
| 6 | `theme` prop on Root wired to `useTheme(option)` |
| 7 | `@custom-variant dark` + class selector on the dark var block; dead `dark` classes become `fl-dark` |
| 8 | `tokens` prop on Root |
| 9 | State lift to Root; `open`/`onOpenChange`; `useFeedback()` |
| 10 | `side` / `align` / `width` on Root |

## Verification

No test runner in this repo, and `npm run lint` is broken under Next 16. The
gates are:

- `npm run build -w feedbackland-react` — `tsc -b` plus the Vite lib build
- `npx tsc --noEmit` at the root
- `npx next build` at the root

Visual verification via `npm run widget-dev` (`package.json:22`), which watches
the package build alongside Next dev: `src/main.tsx`'s matrix harness for the
component, the admin Widget page for the gallery.

**Implementation trap:** the workspace symlink resolves `feedbackland-react` to
`dist/`, not `src/`. The Next app sees nothing until the package is rebuilt —
hence `widget-dev` rather than plain `next dev`.

`package.json:15`'s `release:react` runs `npm version patch`; this release needs
`major`.

## Build sequence

1. `context.tsx` — context shape, `useFeedback()`, controllable state hook.
2. Lift open state out of `OverlayWidget` and `PopoverWidget` into props.
3. `Feedback.tsx` — Root: theme, tokens, widget shell, provider.
4. `button.tsx` — `shape` variant, icon slots.
5. `FeedbackTrigger.tsx` — passthrough, ref, icon rules, placement, trigger-mode
   wiring.
6. `FeedbackButton.tsx` — collapse Root + Trigger over the union prop type.
7. `index.css` — `@custom-variant dark`, dark var block selector.
8. `index.ts` — exports.
9. `lib/widget-presets.ts` — the 14 presets.
10. `lib/widget-snippets.ts` — new props in the generator.
11. `components/app/widget-docs/index.tsx` — gallery row above the controls.
12. `src/main.tsx` — matrix harness.
13. `feedbackland-react/README.md` + root `README.md` — props table, gallery,
    migration note.
14. Version bump to 3.0.0.
