<div align="center">

# feedbackland-react

**Drop a feedback button into your React app.** A slide-in drawer or an anchored popover — your users post ideas, bugs, and requests without ever leaving your product.

<p>
  <a href="https://www.npmjs.com/package/feedbackland-react"><img alt="npm" src="https://img.shields.io/npm/v/feedbackland-react?color=blue"></a>
  <a href="https://github.com/feedbackland/feedbackland/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="React 17 · 18 · 19" src="https://img.shields.io/badge/react-17%20%7C%2018%20%7C%2019-149eca">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-types%20included-3178c6">
</p>

<p>
  <a href="https://demo.feedbackland.com">Live demo</a> ·
  <a href="https://feedbackland.com">feedbackland.com</a> ·
  <a href="https://github.com/feedbackland/feedbackland">Main repo</a>
</p>

</div>

---

## Install

```bash
npm install feedbackland-react
```

## Use

```tsx
import { FeedbackButton } from "feedbackland-react";

export function App() {
  return <FeedbackButton platformId="your-platform-id" />;
}
```

That's the whole integration. The widget ships its own scoped styles — no CSS import, no provider, no setup.

> **Don't write this by hand.**
> Create a board on [feedbackland.com](https://feedbackland.com) (free, MIT-licensed — or [self-host](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md) the whole thing). Your admin panel's **Widget** page renders this exact snippet with your `platformId` pre-filled, alongside a live preview and interactive controls for every prop — copy straight from there.

## Two flavors

```tsx
// Drawer (default) — slide-in side panel with the full board.
<FeedbackButton platformId="..." />

// Popover — anchored inline form; user stays in flow.
<FeedbackButton platformId="..." widget="popover" />
```

|              | **Drawer**                              | **Popover**                                       |
| ------------ | --------------------------------------- | ------------------------------------------------- |
| Layout       | Slide-in side panel, full height        | Anchored to the button, inline                    |
| Mobile       | Same drawer                             | Bottom sheet (auto via media query)               |
| What it shows | Your entire feedback board in an iframe | A single-shot submission form                     |
| Use when     | Feedback deserves a focused experience  | Contextual, in-the-flow feedback                  |

## Style it your way

The widget exposes four progressively more flexible ways to style the trigger button. Pick the one that fits.

**1. Default styled button** — sensible defaults:

```tsx
<FeedbackButton platformId="..." text="Send feedback" variant="outline" size="lg" />
```

**2. Quick Tailwind override** — `tailwind-merge` resolves conflicts, your classes win:

```tsx
<FeedbackButton
  platformId="..."
  className="bg-red-500 hover:bg-red-600 rounded-full px-8"
/>
```

**3. Unstyled** — strip every internal class, start from scratch:

```tsx
<FeedbackButton
  platformId="..."
  variant="unstyled"
  className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
/>
```

**4. Bring your own button** (`asChild`) — total control, Radix-style:

```tsx
<FeedbackButton platformId="..." asChild>
  <button className="any-classes-you-want">
    <YourIcon /> Give feedback
  </button>
</FeedbackButton>
```

`asChild` merges the open handler into your child element, which keeps its own `onClick`, `ref`, and ARIA attributes.

## Props

| Prop          | Type                                                                                          | Default        | Description                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `platformId`  | `string` (UUID)                                                                               | **required**   | Your organization ID — copy from the Widget admin page.                                                  |
| `url`         | `string`                                                                                      | —              | Override the board origin. Required only for self-hosted instances.                                      |
| `widget`      | `"drawer" \| "popover"`                                                                       | `"drawer"`     | Presentation flavor.                                                                                     |
| `text`        | `string`                                                                                      | `"Feedback"`   | Button label. Ignored when `children` is provided.                                                       |
| `variant`     | `"default" \| "secondary" \| "outline" \| "ghost" \| "link" \| "destructive" \| "unstyled"`   | `"default"`    | Visual style preset. `"unstyled"` removes every internal class — pair with `className`.                  |
| `size`        | `"default" \| "sm" \| "lg" \| "icon" \| "icon-sm" \| "icon-lg"`                               | `"default"`    | Size preset.                                                                                             |
| `className`   | `ClassValue`                                                                                  | —              | Tailwind classes merged onto the trigger via `tailwind-merge`. Yours win conflicts with widget defaults. |
| `asChild`     | `boolean`                                                                                     | `false`        | When `true`, your child becomes the trigger directly. Requires a single React element child.             |
| `children`    | `React.ReactNode`                                                                             | —              | Trigger label (overrides `text`), or the trigger element itself when `asChild` is `true`.                |

## Self-hosted instances

Point the widget at your own Feedbackland deployment:

```tsx
<FeedbackButton
  platformId="your-platform-id"
  url="https://your-board.example.com"
/>
```

Self-hosting guide → [SELFHOSTING.md](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md).

## Accessibility

- The drawer renders a proper `role="dialog"` with `aria-modal`, `aria-labelledby`, and a visually hidden title.
- Focus is trapped while open (`react-focus-on`) and restored to the trigger on close. Escape closes the drawer.
- The popover delegates focus management to Radix Popover / Drawer.
- The default trigger has full keyboard activation; `asChild` preserves your own element's `onClick`, `ref`, and ARIA attributes via Radix `Slot`.
- The shimmer skeleton shown while the iframe loads is `aria-hidden`, so assistive tech doesn't announce decorative content.

## Compatibility

- **React** 17 / 18 / 19 — peer dependencies only
- **TypeScript** — types included, strict-mode friendly
- **SSR** — safe with Next.js (App Router and Pages), Remix, Astro
- **Browsers** — modern evergreen (Chrome, Firefox, Safari, Edge); no IE11
- **Node** 18+ for tooling (the runtime is browser-only)

## Under the hood

- **Drawer** opens a portal to `document.body`, renders the full feedback board in an `<iframe>` pointing at `https://<platformId>.feedbackland.com` (or your `url`), and traps focus with [`react-focus-on`](https://github.com/theKashey/react-focus-on). The iframe is `sandbox`ed for defense-in-depth.
- **Popover** uses Radix Popover (desktop) / Radix Drawer (mobile) and `POST`s a single submission to `/api/feedback/create` on the board origin — no iframe, no board UI.
- **Style isolation in both directions** — every Tailwind utility is prefixed `fl:`, every CSS variable lives on `.fl-scope`. Nothing leaks out of the widget, nothing bleeds in from your host app.
- **CSS injected at runtime** by JS — no separate stylesheet to import. The first widget instance per page injects a `<style>` block; subsequent instances reuse it.
- **One `<link rel="preconnect">`** per board origin is added on mount and ref-counted across instances, so the iframe handshake is warm before the user clicks.

Bundle ≈ **110 KB gzipped** (ESM, tree-shakable), including a full Tailwind 4 build, Radix Popover/Drawer, the scope reset, and the iframe error/timeout UI.

## License

MIT © [Feedbackland](https://github.com/feedbackland/feedbackland) — fork it, run it, sell it.
