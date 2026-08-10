<div align="center">

# feedbackland-react

**A feedback button for your React app. One component, one prop, done.**

It connects to your [Feedbackland](https://github.com/feedbackland/feedbackland) board — free and open source (MIT).

<p>
  <a href="https://www.npmjs.com/package/feedbackland-react"><img alt="npm" src="https://img.shields.io/npm/v/feedbackland-react?color=blue"></a>
  <a href="https://github.com/feedbackland/feedbackland/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="React 17 · 18 · 19" src="https://img.shields.io/badge/react-17%20%7C%2018%20%7C%2019-149eca">
</p>

<p>
  <a href="https://demo.feedbackland.com">Live demo</a> ·
  <a href="https://feedbackland.com">feedbackland.com</a> ·
  <a href="https://github.com/feedbackland/feedbackland">Main repo</a>
</p>

</div>

## Install

```bash
npm install feedbackland-react
```

## Use

```tsx
import { FeedbackButton } from "feedbackland-react";

<FeedbackButton platformId="your-platform-id" />
```

That's it. No CSS import, no provider, no config.

Your `platformId` is on your board's admin **Widget** page, which shows a ready-to-copy snippet with the ID filled in. No board yet? Create one free at [feedbackland.com](https://feedbackland.com).

## Drawer or popover

```tsx
<FeedbackButton platformId="..." />                  // drawer (default)
<FeedbackButton platformId="..." widget="popover" /> // popover
```

**Drawer** — clicking the button slides in a panel with your full feedback board. Users post, vote, and comment without leaving your app.

**Popover** — a small form next to the button. Users type, submit, done; the feedback lands on your board anonymously. On screens narrower than 768px it becomes a bottom sheet.

## Make the button yours

Four levels, from zero effort to full control:

```tsx
// 1. Built-in presets
<FeedbackButton platformId="..." text="Give feedback" variant="outline" size="lg" />

// 2. Add your own Tailwind classes — conflicts resolve in your favor
<FeedbackButton platformId="..." className="rounded-full bg-violet-600 hover:bg-violet-700" />

// 3. Start from a bare, unstyled <button>
<FeedbackButton platformId="..." variant="unstyled" className="your-classes" />

// 4. Use your own element as the button
<FeedbackButton platformId="..." asChild>
  <button onClick={yourHandler}>💬 Feedback</button>
</FeedbackButton>
```

With `asChild`, your element **is** the button — the widget only wires up the open handler. Your element's own `onClick`, `ref`, and ARIA attributes keep working, and `text`, `variant`, `size`, and `className` don't apply.

## Props

| Prop         | Type                                                                                        | Default      | Description                                                                       |
| ------------ | ------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `platformId` | `string`                                                                                    | **required** | Your board's ID (a UUID). Copy it from the admin **Widget** page.                 |
| `widget`     | `"drawer" \| "popover"`                                                                     | `"drawer"`   | What the button opens.                                                             |
| `text`       | `string`                                                                                    | `"Feedback"` | Button label. Ignored when `children` is set.                                      |
| `variant`    | `"default" \| "secondary" \| "outline" \| "ghost" \| "link" \| "destructive" \| "unstyled"` | `"default"`  | Button style. `"unstyled"` removes all built-in styling.                           |
| `size`       | `"default" \| "sm" \| "lg" \| "icon" \| "icon-sm" \| "icon-lg"`                             | `"default"`  | Button size. Ignored with `variant="unstyled"`.                                    |
| `className`  | `string` (or any `clsx` value)                                                              | —            | Extra classes for the button, merged with `tailwind-merge` — your classes win.     |
| `asChild`    | `boolean`                                                                                   | `false`      | Use your own element as the button. Requires exactly one element child.            |
| `children`   | `ReactNode`                                                                                 | —            | Button label — or, with `asChild`, the button element itself.                      |
| `url`        | `string`                                                                                    | —            | Your board's full URL. Only needed when self-hosting.                              |

## Self-hosting?

Add `url` — the full URL of your board, including the org path. Keep `platformId`: it identifies your org when feedback is submitted.

```tsx
<FeedbackButton
  platformId="your-platform-id"
  url="https://your-app.vercel.app/your-org"
/>
```

Your own admin **Widget** page generates this snippet too, `url` included. Self-hosting guide → [SELFHOSTING.md](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Good to know

- **Styles can't collide.** Every class the widget uses is namespaced (`fl:` prefix, `.fl-scope` root), isolating its styles from your page's — in both directions.
- **Dark mode is automatic.** The widget follows `<html class="dark">` when your app sets it, otherwise the OS preference — and reacts live to changes.
- **Accessible.** Dialog semantics, focus trapping, and Escape-to-close are built in.
- **Plays nice everywhere.** SSR-safe (Next.js, Remix, …), TypeScript types included, React 17/18/19.
- **Fails loud, not silent.** With an invalid `platformId` the button still renders, the panel explains the problem, and the console tells you how to fix it.

## License

[MIT](https://github.com/feedbackland/feedbackland/blob/main/LICENSE)
