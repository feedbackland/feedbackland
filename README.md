<div align="center">

# Feedbackland

**An open-source feedback board that tells you what to build next.**

<p>Your users write one sentence. You get a ranked list of what to build.</p>

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

A board is easy to launch and hard to keep reading. Posting is a form, so people abandon it;
what lands arrives as thirty posts describing the same problem thirty ways. Six months in,
it's an archive.

Feedbackland works on both ends of that. Familiar shape if you've used Canny, Featurebase or
Fider — the difference is that nothing is gated and nothing is priced per user.

## Posting is one text box

No title field, no category dropdown — the user describes the problem and hits send. A model
writes the title and files it as **idea**, **issue** or **general feedback**, screening text
and images for abuse in the same pass. Signing in is optional — Google, Microsoft, email, or
post anonymously. Posts are embedded into Postgres (`pgvector`), so searching *"can't log in"*
also finds *"auth times out"*.

## Insights tell you what to build

One click collapses the board into a ranked list. *Dark mode*, *night theme* and *black
background* become one insight, not three.

The score comes from your data, not the model's opinion: **reach** (40%, distinct people — one
person upvoting three duplicates counts once), **momentum** (35%, recent activity halving every
21 days), **severity** (25%, the model's read of the damage), times an effort multiplier that
favors quick wins. Open a score and you see the parts.

Every run states what it read, including what it couldn't group:
`84 posts → 19 insights · 6 new · 5 not grouped`. **Ask AI** answers plain questions against
your board: *"What do people complain about most since the redesign?"*

## Dropping it into your app

```bash
npm install feedbackland-react
```

```tsx
import { FeedbackButton } from "feedbackland-react";

<FeedbackButton platformId="your-platform-id" />;
```

That's the whole integration — no CSS import, no provider. A slide-in **drawer** with your full
board, or an anchored **popover** with just the form (`widget="popover"`). ~110 KB gzipped,
React 17–19, SSR-safe. [Props →](feedbackland-react/README.md)

There's also a hosted board at your own subdomain, and a REST endpoint for piping feedback in
from a Slack bot or support inbox. Upvotes, comments with `@`-mentions, rich text, image
uploads, five statuses, filtering, sorting, an admin activity feed and dark mode round it out.

## Run it

| | |
| --- | --- |
| **Live demo** — a real board with full admin access, no signup | [demo.feedbackland.com](https://demo.feedbackland.com) |
| **Hosted** — your own board in about a minute | [get-started.feedbackland.com](https://get-started.feedbackland.com) |
| **Self-hosted** — Vercel + Supabase + Firebase, ~15 minutes | [SELFHOSTING.md](SELFHOSTING.md) |

Hosted and self-hosted run the same code; nothing is feature-gated and there is no paid tier.
Free tiers cover a small board, and every AI feature runs on one cheap model through a single
OpenRouter key.

## Not yet

- **No email notifications** — activity lives in the in-app feed
- **No public changelog**, and no posting on behalf of a user
- **Young project** — expect breaking changes
- **AI features need an OpenRouter key** — the board works without one

Missing something? [Open an issue](https://github.com/feedbackland/feedbackland/issues) — that's how this list gets shorter.

## License

[MIT](LICENSE) — fork it, run it, sell it.

<sub><a href="https://github.com/feedbackland/feedbackland/discussions">Discussions</a> · <a href="https://github.com/feedbackland/feedbackland/issues">Issues</a> · <a href="https://github.com/feedbackland/feedbackland/releases">Releases</a></sub>
