<div align="center">

# Feedbackland

**An open-source feedback board that tells you what to build next.**

<p>
Your users write one sentence. Feedbackland titles it, files it, groups it with<br>
every other post asking for the same thing, and ranks what comes out.
</p>

<p>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://github.com/feedbackland/feedbackland/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/feedbackland/feedbackland?color=blue"></a>
  <a href="https://github.com/feedbackland/feedbackland/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/feedbackland/feedbackland?style=social"></a>
</p>

<p>
  <a href="https://demo.feedbackland.com"><b>Live demo →</b></a> ·
  <a href="https://get-started.feedbackland.com">Create a board</a> ·
  <a href="SELFHOSTING.md">Self-host</a>
</p>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/homepage_dark_mode.png">
  <img alt="A Feedbackland board" src="screenshots/homepage_light_mode.png">
</picture>

</div>

---

## Why

A feedback board is easy to launch and hard to keep. Posting is a form — title, category,
description, preview — so plenty of people start and don't finish. What does land arrives
as thirty posts describing the same problem thirty ways, and reading all of them is an
afternoon that never gets scheduled. Six months in, the board is an archive.

Feedbackland works on both ends of that. Posting is one text box. Reading is a page that
groups the whole board into a ranked list of things to do — and shows the arithmetic behind
the ranking, so you can disagree with it.

If you've used Canny, Featurebase or Fider, the shape is familiar. The difference is what
happens after the feedback lands.

## Posting is one text box

No title field, no category dropdown — the user describes the problem and hits send. Fewer
fields means more people finish the form, and that's the whole reason for it.

A model writes the title and files the post as **idea**, **issue** or **general feedback**.
Text and any attached images are checked for abuse in the same pass and rejected before they
reach your board. The post is embedded into Postgres (`pgvector`) on the way in, so searching
*"can't log in"* also turns up *"auth times out"*.

## Insights: what to build next

One click reads the board and returns a ranked list. Posts describing the same underlying
need collapse into one item — *dark mode*, *night theme* and *black background* are one
insight, not three.

The ranking is computed from your data, not asserted by the model:

- **Reach** (40%) — distinct people behind it. One person upvoting three duplicates counts
  once.
- **Momentum** (35%) — recent posts, upvotes and comments, halving in weight every 21 days.
- **Severity** (25%) — the model's read of the damage the problem does. It's told to judge
  the problem alone and ignore how many people asked, because demand is already counted above.
- **Effort** — a small/medium/large estimate that nudges quick wins up and big builds down.

The model does the judging — which posts belong together, how bad the problem is, how big
the build. Everything countable is measured against your database, and the server does the
weighting. Where batches get merged, the model returns only which ones to combine, never new
text. Open a score and you see the parts it came from.

Every run states what it read — *84 posts → 19 insights · 6 new · 5 not grouped* — including
what it couldn't group. Insights keep their identity between runs, so you get *+3 people
since last run* instead of a fresh list each time. Setting a status on an insight sets it on
every post behind it. Up to 1000 posts per run.

Separately, **Ask AI** answers plain questions against every active post on your board:
*"What do people complain about most since the redesign?"*

## Adding it to your product

**A React widget** — users never leave your app.

```bash
npm install feedbackland-react
```

```tsx
import { FeedbackButton } from "feedbackland-react";

<FeedbackButton platformId="your-platform-id" />;
```

That's the whole integration — no CSS import, no provider. Two flavors: a slide-in **drawer**
holding your full board, or an anchored **popover** with a single submission form
(`widget="popover"`). ~110 KB gzipped, React 17/18/19, SSR-safe, styles isolated in both
directions.

> Props, styling escape hatches and accessibility notes:
> [`feedbackland-react/README.md`](feedbackland-react/README.md) · [npm](https://www.npmjs.com/package/feedbackland-react)

**A hosted board** at your own subdomain — public, linkable, works without the widget.

**A REST endpoint** — pipe feedback in from a Slack bot, a support inbox, a CLI.

```bash
curl -X POST https://your-board.feedbackland.com/api/feedback/create \
  -H "Content-Type: application/json" \
  -d '{"orgId": "your-platform-id", "description": "We need dark mode in settings."}'
```

<sub><code>orgId</code> is the same ID the widget takes as <code>platformId</code>. Both are on your admin panel's Widget page.</sub>

## Everything else

- Upvotes, comments with `@`-mentions, rich text, image uploads
- Five statuses: under consideration · planned · in progress · done · declined
- Filter the board by status; sort by newest, most upvoted or most commented
- Admin panel — edit, delete, reply, set status, invite other admins
- Activity feed with unread tracking, filterable by category
- Optional AI pass to clean up a post's writing before it's submitted
- Sign in with Google, Microsoft, or email and password
- Light and dark mode; the widget follows your app's theme

## Try it

| | |
| --- | --- |
| **Live demo** — a real board with full admin access, no signup | [demo.feedbackland.com](https://demo.feedbackland.com) |
| **Hosted** — your own board in about a minute | [get-started.feedbackland.com](https://get-started.feedbackland.com) |
| **Self-hosted** — Vercel + Supabase + Firebase, ~15 minutes | [SELFHOSTING.md](SELFHOSTING.md) |

Hosted and self-hosted run the same code. Nothing is feature-gated and there's no paid tier.
Self-hosting costs what your own usage costs — Supabase and Vercel have free tiers that cover
a small board, and every AI feature runs on one cheap model through a single OpenRouter key.

## Not there yet

The gaps, so you can judge the fit:

- **No email notifications.** Activity lives in the in-app feed — no digests, no reply alerts.
- **No public changelog**, and no posting on behalf of a user.
- **Young project.** Expect rough edges and breaking changes between releases.
- **Self-hosting needs an OpenRouter key.** The board works fine without one; every AI
  feature goes quiet.

Missing something you need? [Open an issue](https://github.com/feedbackland/feedbackland/issues) — that's how this list gets shorter.

## Built with

[Next.js](https://github.com/vercel/next.js) · [React](https://github.com/facebook/react) · [TypeScript](https://github.com/microsoft/TypeScript) · [PostgreSQL](https://github.com/postgres/postgres) · [tRPC](https://github.com/trpc/trpc) · [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) · [shadcn/ui](https://github.com/shadcn-ui/ui) · [Tiptap](https://github.com/ueberdosis/tiptap)

## License

[MIT](LICENSE) — fork it, run it, sell it.

<sub><a href="https://github.com/feedbackland/feedbackland/discussions">Discussions</a> · <a href="https://github.com/feedbackland/feedbackland/issues">Issues</a> · <a href="https://github.com/feedbackland/feedbackland/releases">Releases</a></sub>
