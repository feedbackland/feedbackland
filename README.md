<div align="center">

# Feedbackland

### The open-source feedback platform.

A **free and unlimited** alternative to Canny.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Self-Hosted](https://img.shields.io/badge/self--hosted-ready-green)](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/feedbackland/feedbackland/pulls)

[Live Demo](https://demo.feedbackland.com) &middot; [Get Started Free](https://get-started.feedbackland.com) &middot; [Self-Host](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

</div>

&nbsp;

<img width="2425" height="1821" alt="feedbackland_github_4" src="https://github.com/user-attachments/assets/72e5a7ab-ffbf-4f76-b9de-8bda15b6a78b" />

&nbsp;

## Why Feedbackland?

Most feedback tools charge per seat, gate features behind tiers, and lock you into their ecosystem. Feedbackland is different:

- **Free forever, no limits.** Unlimited feedback, users, and admins. MIT licensed. No upgrade walls.
- **AI that actually helps.** Auto-generate a prioritized roadmap from raw feedback, or ask questions like *"What do users hate about the login flow?"* and get cited answers instantly.
- **Works where your users are.** Standalone board, embeddable widget, or drop-in React/Next.js components — your call.
- **Modern stack, no compromises.** Next.js 16, TypeScript, tRPC, Tailwind, shadcn/ui, Kysely, and Postgres.

## Features

| Feature | Description |
|---|---|
| **Feedback Board** | Public or private board where users submit, upvote, and discuss ideas. |
| **AI Roadmap** | Automatically distills all feedback into a prioritized, shareable product roadmap. Exportable as PDF. |
| **Ask AI** | Chat with your feedback data. Get instant, cited answers to product questions. |
| **Semantic Search** | Find feedback by meaning, not just keywords, powered by pgvector embeddings. |
| **Content Moderation** | AI-powered automatic detection of spam, abuse, and inappropriate content. |
| **Status Workflow** | Track posts through Under Consideration, Planned, In Progress, Done, and Declined. |
| **Categories** | Organize feedback as ideas, issues, or general feedback. |
| **Comments & Threads** | Nested comment threads with editing, deletion, and upvoting. |
| **Activity Feed** | Real-time feed of new posts and comments with unread tracking. |
| **Embeddable Widgets** | Drop a React/Next.js widget into your app with a built-in configurator and live preview. |
| **Admin Dashboard** | Manage posts, track activity, invite team members, and configure your platform. |
| **SSO / OAuth** | Google and Microsoft sign-in out of the box, plus email/password auth. |
| **Org Customization** | Custom logo, title, description, and subdomain per organization. |
| **Dark Mode** | Full dark mode support across the entire UI. |

## Get Running

**Cloud** — Your own instance, free, cloud-hosted. Nothing to install. Up and running in 30 seconds.
<br>
**[Create your platform &rarr;](https://get-started.feedbackland.com)**

**Self-hosted** — Deploy on your own infrastructure with Vercel + Supabase + Firebase. Up and running in 30 minutes.
<br>
**[Read the self-hosting guide &rarr;](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)**

## Demo

See the full admin experience without creating an account.

| | |
|---|---|
| **URL** | [demo.feedbackland.com](https://demo.feedbackland.com) |
| **Email** | `admin@demo.com` |
| **Password** | `demo1234` |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict) |
| API | [tRPC](https://trpc.io) |
| Database | [PostgreSQL](https://www.postgresql.org) + [Kysely](https://kysely.dev) |
| Search | [pgvector](https://github.com/pgvector/pgvector) |
| Auth | [Firebase Auth](https://firebase.google.com/products/auth) |
| UI | [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| AI | [OpenRouter](https://openrouter.ai) |
| Email | [Resend](https://resend.com) |
| Hosting | [Vercel](https://vercel.com) + [Supabase](https://supabase.com) |

## Local Development

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
git clone https://github.com/feedbackland/feedbackland.git
cd feedbackland
cp .env.example .env.local   # fill in your values
npm install
npm run migrate-up
npm run dev
```

See the [self-hosting guide](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md) for details on setting up each environment variable.

## Contributing

Contributions are welcome and encouraged! To get started:

1. Open an [issue](https://github.com/feedbackland/feedbackland/issues) to discuss what you'd like to change.
2. Fork the repo and set up local development (see above).
3. Run `npm run lint` before submitting a PR.
4. Submit a PR and reference the issue.

The codebase uses TypeScript strict mode, Tailwind CSS, and shadcn/ui conventions.

## License

MIT &copy; [Feedbackland](https://github.com/feedbackland/feedbackland)
