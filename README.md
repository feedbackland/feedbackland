<div align="center">

# Feedbackland

**The open-source, AI-powered feedback platform.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Self-Hosted](https://img.shields.io/badge/self--hosted-ready-green)](SELFHOSTING.md)

[Live Demo](https://demo.feedbackland.com) &middot; [Get Started Free](https://get-started.feedbackland.com) &middot; [Self-Hosting Guide](SELFHOSTING.md)

<br>

![Feedbackland Dashboard](https://github.com/user-attachments/assets/b14c3a84-19af-4ca6-b4e7-560c6db8c2e2)

</div>

## Stop paying for user feedback

Tools like Canny and Upvoty lock basic features like SSO and unlimited admins behind enterprise paywalls. **Feedbackland is a true open-source (MIT), forever-free alternative.** No feature gating, no artificial limits, and total ownership of your data.

## Core Features

* **100% Free & Open Source:** Unlimited feedback, unlimited users, and unlimited admins.
* **AI-Powered Insights:** Auto-generate prioritized roadmaps, auto-moderate spam, and use semantic search to "chat" with your user feedback.
* **Zero-Friction UX:** Deploy standalone boards, or embed our drop-in React/Next.js widgets directly into your app.
* **Complete Workflows:** Custom status tracking, smart categorization, threaded comments, and built-in SSO (Google/Microsoft).

## Live Demo

Experience the full admin interface with sample data:
&rarr; **[demo.feedbackland.com](https://demo.feedbackland.com)** *(Login: `admin@demo.com` / `demo1234`)*

## Get Started

Choose the deployment path that fits your needs:

**1. Cloud Hosted (Fastest)** Your own free, cloud-hosted instance. No credit card required.  
&rarr; **[Create your platform in 30 seconds](https://get-started.feedbackland.com)**

**2. Self-Hosted (Total Control)** Own your infrastructure (Vercel + Supabase + Firebase).  
&rarr; **[Read the 30-minute self-hosting guide](SELFHOSTING.md)**

**3. Local Development** ```bash
git clone [https://github.com/feedbackland/feedbackland.git](https://github.com/feedbackland/feedbackland.git)
cd feedbackland
cp .env.example .env.local   # Configure your variables
npm install
npm run migrate-up
npm run dev
