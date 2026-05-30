<div align="center">

# Feedbackland

**The open-source feedback platform**

<p>
<div>Collect user feedback via in-app widgets, a dedicated website, or API endpoint.</div>
<div>Let AI turn it into actionable to-dos. Free, open-source, and unlimited.</div>
</p>

<p>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="SELFHOSTING.md"><img alt="Self-hosted ready" src="https://img.shields.io/badge/self--hosted-ready-green"></a>
  <a href="https://github.com/feedbackland/feedbackland/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/feedbackland/feedbackland?color=blue"></a>
  <a href="https://github.com/feedbackland/feedbackland/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/feedbackland/feedbackland?style=social"></a>
</p>

<p>
  <a href="https://get-started.feedbackland.com"><b>Create your board →</b></a> ·
  <a href="https://demo.feedbackland.com">Live demo</a> ·
  <a href="SELFHOSTING.md">Self-host</a>
</p>

<br>

![Feedbackland Dashboard](https://github.com/user-attachments/assets/39671ac5-00dd-4197-a591-eba16c210b1d)

</div>

---

## Why Feedbackland?

- **AI does the boring parts.** AI automatically writes your roadmap as feedback lands.
- **Ask in plain English.** *"What do paying users complain about most?"* — real answers from your real feedback.
- **One-line widget, two flavors.** Drop a slide-in **drawer** or an anchored **popover** into your React app. Users never leave your product.
- **Free forever.** MIT, self-hostable, no seat caps, no per-user pricing — ever.

## Features

- Public feedback board with comments, upvotes, statuses, semantic search
- Embeddable React widget in two variants — slide-in **drawer** or anchored **popover**
- AI-generated roadmap
- Ask AI anything about all your collected feedback
- REST API to pipe feedback in from anywhere
- SSO (Google, Microsoft) and email/password
- Admin dashboard — moderate, tag, respond, export feedback

## Embed the widget

[Check out the widgets on the live demo platform](https://demo.feedbackland.com/admin/widget)

```bash
npm install feedbackland-react
```

```tsx
import { FeedbackButton } from "feedbackland-react";

<FeedbackButton platformId="your-platform-id" />
```

> [!TIP]
> After you create a board, your admin panel's **Widget** page renders this snippet with the real ID pre-filled, plus a live preview and interactive controls for every prop.

Two flavors:

|                  | **Drawer** (default)                | **Popover**                                |
| ---------------- | ----------------------------------- | ------------------------------------------ |
| Layout           | Slide-in side panel, full height    | Anchored inline form, stays in the page    |
| What it shows    | Your entire feedback board (iframe) | A single-shot submission form (no iframe)  |
| Mobile           | Same drawer                         | Bottom sheet (auto via media query)        |
| Use when         | A dedicated feedback experience     | Contextual, in-flow feedback               |

Switch flavors with the `widget` prop:

```tsx
<FeedbackButton platformId="..." widget="popover" />
```

### Customize the trigger

```tsx
// Tailwind override — tailwind-merge resolves conflicts, your classes win
<FeedbackButton platformId="..." className="bg-red-500 rounded-full px-8" />

// Strip every internal class — start fresh with your own
<FeedbackButton platformId="..." variant="unstyled" className="my-button" />

// Bring your own element — Radix-style asChild, total control
<FeedbackButton platformId="..." asChild>
  <button className="any tailwind you want">
    <FeedbackIcon /> Give feedback
  </button>
</FeedbackButton>
```

`asChild` merges the open handler into your child element, which keeps its own `onClick`, `ref`, and ARIA attributes.

> [!NOTE]
> **Full widget docs** — props reference, accessibility guarantees, bundle internals, self-hosted usage — live in the package README: [`feedbackland-react/README.md`](feedbackland-react/README.md). The package is also on [npm](https://www.npmjs.com/package/feedbackland-react).

## Get started

| Path | |
| --- | --- |
| **Hosted** — live in under a minute, free forever | [get-started.feedbackland.com](https://get-started.feedbackland.com) |
| **Self-hosted** — live in under 30 min using Vercel, Supabase, Firebase Auth | [SELFHOSTING.md](SELFHOSTING.md) |
| **Live demo** — real board, full admin access, no signup required | [demo.feedbackland.com](https://demo.feedbackland.com) |

> [!TIP]
> Hosted and self-hosted share the exact same codebase. No feature-gating, ever.

## How it compares

|                              |   Feedbackland   |        Canny         |       Featurebase        |       Fider        |
| ---------------------------- | :--------------: | :------------------: | :----------------------: | :----------------: |
| **License**                  |       MIT        |     Proprietary      |       Proprietary        |        AGPL        |
| **Self-host**                |        ✅        |          —           |            —             |         ✅         |
| **Free hosted plan**         |    Unlimited     |     25-user cap      |        Trial only        |         —          |
| **Paid pricing**             |     **None**     |  $19+/mo, per-user   |   $29+/seat + AI usage   |   $49+/mo cloud    |
| **AI duplicate clustering**  |        ✅        |          ✅          |            —             |         —          |
| **AI-generated roadmap**     |        ✅        |          —           |            —             |         —          |
| **Ask AI over your feedback**|        ✅        |          —           |            —             |         —          |

## Built with

[Next.js](https://github.com/vercel/next.js) · [React](https://github.com/facebook/react) · [TypeScript](https://github.com/microsoft/TypeScript) · [PostgreSQL](https://github.com/postgres/postgres) · [tRPC](https://github.com/trpc/trpc) · [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) · [shadcn/ui](https://github.com/shadcn-ui/ui) · [Tiptap](https://github.com/ueberdosis/tiptap)

## Community

[Discussions](https://github.com/feedbackland/feedbackland/discussions) · [Issues](https://github.com/feedbackland/feedbackland/issues) · [Releases](https://github.com/feedbackland/feedbackland/releases)

## License

[MIT](LICENSE) — fork it, run it, sell it.
