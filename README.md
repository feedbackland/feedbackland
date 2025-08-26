# Feedbackland: Widget In. Roadmap Out.

Drop in our widget to capture user feedback. Watch as AI analyzes everything, uncovers hidden insights, and writes your prioritized roadmap. No manual sorting, no guesswork, just data-driven clarity on what to build next.

Open-source & [self-hostable](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md), or [cloud-hosted](https://www.feedbackland.com) with a [generous free tier](https://www.feedbackland.com/#pricing).

https://github.com/user-attachments/assets/1b455e94-6117-4ba4-8369-fa2bda2d3590

## How it works

1. 🗣️ Collect user feedback, votes, and comments right inside your app—with a single click.
2. 🤖 AI analyzes everything, surfaces themes and hidden insights, and delivers a prioritized roadmap.
3. 🚀 Ship the features and fixes your users care about most. No guesswork needed.

## Preview the widget

[Visit Feedbackland's website]([https://www.feedbackland.com](https://www.feedbackland.com/#embed) to preview the widget.

## Embed the widget

Embed Feedbackland's widget in 30 seconds in your React/Nextjs app:

```
npm i feedbackland-react
```

```tsx
import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="<RANDOMLY-GENERATED-UUIDV4>" // required, a UUID v4, generate one here: https://www.uuidtools.com/v4
  mode="" // 'dark' or 'light', defaults to 'dark'
  text="" // the copy text of the button, defaults to 'Feedback'
  className="" // style the button with Tailwind
  style={} // or style it with native CSS
  button={} // or bring your own button
/>
```

Alternatively [get your code snippet with an already pre-filled `platformId`](https://www.feedbackland.com/#embed) from the Feedbackland website.

Not interested in the widget or not using React? No problem, [start with the standalone platform](https://get-started.feedbackland.com).

## Self-host it

Want to self-host your Feedbackland platform? [Go to the self-hosting docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Contact us

Have a question or need support? We're here to help. [hello@feedbackland.com](mailto:hello@feedbackland.com)

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform](https://dogfood.feedbackland.com)!

For technical and code-related issues, ideas & discussions, please feel free to use this repository's [Issues section](https://github.com/feedbackland/feedbackland/issues).

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
