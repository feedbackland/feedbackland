<div align="center">

# Feedbackland

**The free, unlimited, and open-source feedback platform.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Self-Hosted](https://img.shields.io/badge/self--hosted-ready-green)](SELFHOSTING.md)

[Live Demo](https://demo.feedbackland.com) &middot; [Get Started Free](https://get-started.feedbackland.com) &middot; [Self-Hosting Guide](SELFHOSTING.md)

<br>

![Feedbackland Dashboard](https://github.com/user-attachments/assets/39671ac5-00dd-4197-a591-eba16c210b1d)

</div>

## Stop paying to get feedback from your users

Platforms like Canny and Upvoty bait you with basic free tiers, only to hit you with strict usage limits and lock essential features—like SSO, white-labeling, or multiple admins behind expensive paywalls.

**Feedbackland is radically simple: completely free, true open-source (MIT), and forever unrestricted.**

* **Zero Limits:** Unlimited posts, unlimited tracked users, unlimited boards, and unlimited admins.
* **Zero Feature Gating:** All features are freely available, including SSO, white-labeling and AI Insights.
* **Zero Strings Attached:** No hidden paywalls, no vendor lock-in, and absolute ownership of your data.

## Core Features

* **AI-Powered Insights:** Auto-generate prioritized roadmaps and ask our AI any question about your feedback data.
* **Zero-Friction UX:** Deploy a standalone board or embed our drop-in widget directly into your application.
* **Complete Workflows:** Custom status tracking, smart categorization, threaded comments, and built-in SSO.
* **Modern Stack:** Built for speed and scale with Next.js, PostgreSQL, and Tailwind.

## Live Demo

Experience the full platform:
&rarr; **[demo.feedbackland.com](https://demo.feedbackland.com)** *(Login: `admin@demo.com` / `demo1234`)*

## Get Started

Choose the deployment path that fits your needs:

**1. Cloud Hosted (Fastest)** Your own free, cloud-hosted instance.
&rarr; **[Create your platform in 30 seconds](https://get-started.feedbackland.com)**

**2. Self-Hosted (Total Control)** Own your platform completely.
&rarr; **[Read the 30-minute self-hosting guide](SELFHOSTING.md)**

**3. Local Development** 
```bash
git clone [https://github.com/feedbackland/feedbackland.git](https://github.com/feedbackland/feedbackland.git)
cd feedbackland
cp .env.example .env.local   # Configure your variables
npm install
npm run migrate-up
npm run dev
```
