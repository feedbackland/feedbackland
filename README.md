<div align="center">

# Feedbackland

### The open-source, AI-powered feedback platform.

**The true open-source, forever-free alternative to Canny.** <br>
Stop paying thousands of dollars a year to listen to your users. No paywalls, no limits, no vendor lock-in.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Self-Hosted](https://img.shields.io/badge/self--hosted-ready-green)](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/feedbackland/feedbackland/pulls)

[Live Demo](https://demo.feedbackland.com) &middot; [Get Started Free](https://get-started.feedbackland.com) &middot; [Self-Hosting Guide](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

</div>

&nbsp;

<img width="2425" height="1821" alt="feedbackland_github_4" src="https://github.com/user-attachments/assets/72e5a7ab-ffbf-4f76-b9de-8bda15b6a78b" />

&nbsp;

## 🛑 Stop paying for user feedback

Tools like Canny, Upvoty, and UserVoice lock basic features like SSO, white-labeling, and unlimited admins behind enterprise paywalls costing hundreds or thousands of dollars a month. 

**Feedbackland is different.** We believe collecting user feedback should be a fundamental right for every product team, from solo founders to large enterprises. That's why Feedbackland is built as a **true open-source (MIT)** platform. You retain complete ownership of your data, with no feature gating and no artificial limits.

## ✨ Why Feedbackland?

- **100% Free & Open Source.** Unlimited feedback, unlimited users, and unlimited admins. The MIT license means you have complete freedom to use, modify, and distribute the software.
- **AI That Actually Helps.** Don't just collect feedback—understand it. Auto-generate prioritized roadmaps from raw posts. Ask your data questions like *"What do our enterprise users hate about the login flow?"* and get cited answers instantly.
- **Works Where Your Users Are.** Deploy a standalone feedback board, embed a drop-in widget in your app, or use our React/Next.js components. The friction to leave feedback is zero.
- **Modern Stack, No Compromises.** Built for scale and developer happiness using Next.js 16, TypeScript, tRPC, Tailwind CSS, shadcn/ui, Kysely, and PostgreSQL.

## 🚀 Features

Everything you need to build better products, without the enterprise price tag.

| Feature | Description |
|---|---|
| **Feedback Boards** | Public or private boards where users can submit, upvote, and discuss ideas. |
| **AI Roadmap** | Automatically distills all feedback into a prioritized, shareable product roadmap (exportable as PDF). |
| **Ask AI** | Chat with your feedback data. Get instant, cited answers to complex product questions. |
| **Semantic Search** | Find feedback by meaning, not just keywords. Powered by `pgvector` embeddings. |
| **Content Moderation** | AI-powered automatic detection of spam, abuse, and inappropriate content. Keep your boards clean automatically. |
| **Status Workflows** | Keep users in the loop. Track posts through *Under Consideration, Planned, In Progress, Done,* and *Declined*. |
| **Smart Categories** | AI automatically categorizes incoming feedback as ideas, bugs, or general feedback. |
| **Comments & Threads** | Nested comment threads with editing, deletion, and upvoting to foster community discussion. |
| **Activity Feed** | Real-time feed of new posts and comments with unread tracking. |
| **Embeddable Widgets** | Drop a React/Next.js widget into your app with a built-in configurator and live preview. |
| **Admin Dashboard** | Manage posts, track platform activity, invite team members, and configure your settings. |
| **SSO / OAuth included** | Google and Microsoft sign-in out of the box, plus email/password auth—*features competitors charge $400+/mo for.* |
| **Org Customization** | Fully white-label your board. Custom logo, title, description, and subdomain per organization. |
| **Dark Mode** | First-class dark mode support across the entire UI. |

## 📦 Get Running

Choose the deployment method that works best for you.

**☁️ Cloud Hosted (Fastest)**<br>
Your own instance, free, and cloud-hosted by us. Nothing to install, no credit card required. Up and running in 30 seconds.
&rarr; **[Create your platform](https://get-started.feedbackland.com)**

**🖥️ Self-Hosted (Total Control)**<br>
Deploy on your own infrastructure with Vercel + Supabase + Firebase. Own your data completely. Up and running in 30 minutes.
&rarr; **[Read the self-hosting guide](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)**

## 🎮 Live Demo

Want to see what it looks like under the hood? Check out the full admin experience with sample data.

| | |
|---|---|
| **URL** | [demo.feedbackland.com](https://demo.feedbackland.com) |
| **Email** | `admin@demo.com` |
| **Password** | `demo1234` |

## 🛠️ Tech Stack

Built with modern, battle-tested tools to ensure top-tier performance and developer experience.

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) |
| **Language** | [TypeScript](https://www.typescriptlang.org) (strict) |
| **API** | [tRPC](https://trpc.io) |
| **Database** | [PostgreSQL](https://www.postgresql.org) + [Kysely](https://kysely.dev) |
| **Search** | [pgvector](https://github.com/pgvector/pgvector) |
| **Auth** | [Firebase Auth](https://firebase.google.com/products/auth) |
| **UI** | [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| **AI** | [OpenRouter](https://openrouter.ai) |
| **Email** | [Resend](https://resend.com) |
| **Hosting** | [Vercel](https://vercel.com) + [Supabase](https://supabase.com) |

## 💻 Local Development

Want to contribute or customize your self-hosted instance? 

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# 1. Clone the repository
git clone [https://github.com/feedbackland/feedbackland.git](https://github.com/feedbackland/feedbackland.git)

# 2. Enter the directory
cd feedbackland

# 3. Set up environment variables
cp .env.example .env.local   # fill in your values

# 4. Install dependencies
npm install

# 5. Run database migrations
npm run migrate-up

# 6. Start the development server
npm run dev
