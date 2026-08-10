<div align="center">

# Feedbackland

**An open-source feedback board that does the reading for you.**

<p>
  One text box in, a ranked shortlist out.<br>
  MIT licensed. Self-hostable. Hosted and self-hosted run the same code.
</p>

<p>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://github.com/feedbackland/feedbackland/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/feedbackland/feedbackland?color=blue"></a>
  <a href="https://www.npmjs.com/package/feedbackland-react"><img alt="npm" src="https://img.shields.io/npm/v/feedbackland-react?color=blue&label=widget"></a>
  <a href="https://github.com/feedbackland/feedbackland/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/feedbackland/feedbackland?style=social"></a>
</p>

<p>
  <a href="https://demo.feedbackland.com"><b>Live demo →</b></a> ·
  <a href="https://get-started.feedbackland.com">Create a board</a> ·
  <a href="SELFHOSTING.md">Self-host</a>
</p>

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/homepage_dark_mode.png">
  <img alt="A Feedbackland board: a single posting box above a list of posts with upvotes, comments, categories and statuses" src="screenshots/homepage_light_mode.png">
</picture>

## Why

Feedback boards fail from both ends. On the way in, posting means a form — a title, a category, an account — and most people close the tab instead. On the way out, the same request arrives as thirty differently-worded posts, the votes split thirty ways, and reading it all is an afternoon that never gets scheduled. Six months in, the board is an archive.

Feedbackland is built against both failure modes.

**Posting is one text box.** Type, send, done. The title gets written for you, the post gets filed as idea, issue or general feedback, and spam — text *and* images — is screened before it lands. People sign in with Google, Microsoft or email, or post anonymously.

**Reading is a ranked shortlist.** *Insights* merges posts that ask for the same thing — "dark mode", "night theme", "black background" become one theme — and ranks every theme by how many people are behind it, how fast it's growing, and how much the problem hurts.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/insights_dark_mode.png">
  <img alt="The Insights page: posts merged into ranked themes, a run strip stating how many posts could not be grouped, and a status control per theme" src="screenshots/insights_light_mode.png">
</picture>

**The numbers show their work.** The model's job is grouping and describing; the counting is done in code, from your database. Click a score and the arithmetic opens up — reach 40%, momentum 35%, severity 25%, each with the raw count behind it. Reach counts distinct people, because one user upvoting three duplicates of the same request is one person asking. Severity is the model's read of the problem, and the UI says so. The whole formula is a few lines in [`lib/insights.ts`](lib/insights.ts). And every run states what it *didn't* do — "84 posts → 19 insights · 5 not grouped" — so you can check the analysis instead of having to believe it.

**Closing the loop is one click.** Set *planned*, *in progress* or *done* on a theme and every post behind it updates. Ask AI answers plain-English questions about your feedback and cites its sources — every citation is resolved against the database, so an invented one disappears instead of becoming a broken link. Search works by meaning, so "can't log in" finds "auth times out".

## Getting feedback in

Three doors, one board.

**1 · The widget** — your whole board in a drawer inside your app, or a minimal anonymous form (`widget="popover"`).

```bash
npm install feedbackland-react
```

```tsx
import { FeedbackButton } from "feedbackland-react";

<FeedbackButton platformId="your-platform-id" />;
```

That's the whole integration — no CSS import, no provider, no backend of yours to run. Restyle the button or swap in your own; point it at a self-hosted board with the `url` prop. ~110 KB gzipped · React 17–19 · SSR-safe · styles isolated both ways · [all props →](feedbackland-react/README.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/widget_opened_dark_mode.png">
  <img alt="The drawer widget: the full feedback board sliding in over the host application" src="screenshots/widget_opened_light_mode.png">
</picture>

**2 · The board** — every board lives at its own URL (`you.feedbackland.com` hosted, or your own domain when self-hosted), with upvotes, threaded comments and statuses built in.

**3 · The API** — `POST` one public endpoint to pipe feedback in from Slack, a support inbox, a CLI, anywhere:

```bash
curl -X POST https://api.feedbackland.com/api/feedback/create \
  -H "Content-Type: application/json" \
  -d '{"orgId": "your-platform-id", "description": "We need a dark mode option."}'
```

Self-hosted, the same endpoint lives at `https://your-domain/api/feedback/create`.

## Run it

| | |
| --- | --- |
| **Demo** — full admin, no signup | [demo.feedbackland.com](https://demo.feedbackland.com) |
| **Hosted** — a board in about a minute | [get-started.feedbackland.com](https://get-started.feedbackland.com) |
| **Self-host** — Vercel + Supabase + Firebase + OpenRouter, ~15 min | [SELFHOSTING.md](SELFHOSTING.md) |

## Is it actually free?

- **MIT, all of it.** No enterprise directory, no license keys, no open-core split. [LICENSE](LICENSE) is 21 lines.
- **Hosted and self-hosted run the same code.** A `SELF_HOSTED` flag exists; grep it and you'll find it changes how board URLs are displayed, what the widget snippet looks like, and nothing else you'd notice. There is no hosted-only feature to migrate away from.
- **Nothing is priced per seat, per tracked user, or per anything.** There's no billing code in the tree to find. There used to be: an earlier version gated Insights behind a $29/month plan, under an AGPL license. Both were deleted in January 2026 — one commit ([`58d0e68`](https://github.com/feedbackland/feedbackland/commit/58d0e68)), −1,020 lines. MIT on released code is irrevocable, which is the only "free forever" that means anything.
- **What running it costs:** the self-hosted stack starts entirely on free tiers. The one metered piece is the LLM that writes titles, screens spam, powers search and builds Insights — it needs an [OpenRouter](https://openrouter.ai) key, and a small board runs on cents per month.
- **Your data is plain Postgres.** Self-hosted, you hold the connection string; `pg_dump` and you're out.

## Not there yet

No email notifications (the only email anyone gets is Firebase's password reset), no webhooks, no public changelog. Insights runs when you press **Generate**, not on a schedule. The model is currently hardcoded to Gemini via OpenRouter — no local-model option yet. [Open an issue](https://github.com/feedbackland/feedbackland/issues) if one of these should come next.

## Under the hood

Next.js 16 (App Router) · React 19 · TypeScript · tRPC 11 · Kysely on Postgres · pgvector for semantic search · Firebase Auth · Tailwind 4 · TipTap. The widget is its own workspace in this repo, built with Vite, with React 17–19 as its only peer dependencies.

Local development runs against the same four services as a deployed instance — the [self-hosting guide](SELFHOSTING.md#optional--local-development) covers setup, then `npm run widget-dev` builds the widget alongside the Next dev server. Issues and PRs are welcome; for anything sizeable, open an issue first.

## License

[MIT](LICENSE) — fork it, run it, own it.
