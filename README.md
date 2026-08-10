<div align="center">

# Feedbackland

**Open-source user feedback: an embeddable widget, a feedback board, and AI insights that tell you what to build next.**

<p>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="https://www.npmjs.com/package/feedbackland-react"><img alt="npm" src="https://img.shields.io/npm/v/feedbackland-react?color=blue&label=widget"></a>
</p>

<p>
  <a href="https://demo.feedbackland.com">Live demo</a> ·
  <a href="https://feedbackland.com">feedbackland.com</a> ·
  <a href="SELFHOSTING.md">Self-host</a>
</p>

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/homepage_dark_mode.png">
  <img src="screenshots/homepage_light_mode.png" alt="A Feedbackland feedback board, where users post, upvote, and comment">
</picture>

## The widget

One component, one prop:

```bash
npm install feedbackland-react
```

```tsx
import { FeedbackButton } from "feedbackland-react";

<FeedbackButton platformId="your-platform-id" />
```

That's the whole integration. It opens your full board in a slide-in drawer, or a lightweight popover form. Style the button or bring your own. [Widget docs →](feedbackland-react/README.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/widget_opened_dark_mode.png">
  <img src="screenshots/widget_opened_light_mode.png" alt="The Feedbackland widget opened as a drawer inside an app">
</picture>

## AI insights

One click turns your whole board into a short, ranked list of underlying needs — scored by reach, momentum, severity, and effort. Or just ask: a built-in chat answers questions about your feedback.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/insights_dark_mode.png">
  <img src="screenshots/insights_light_mode.png" alt="Ranked insights generated from feedback posts">
</picture>

## Free & open source

- **MIT-licensed** — fork it, run it, sell it.
- **Hosted free** at [feedbackland.com](https://feedbackland.com).
- **Or self-host** on free tiers in ~15 minutes → [SELFHOSTING.md](SELFHOSTING.md)

## License

[MIT](LICENSE)
