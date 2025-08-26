# Feedbackland: Widget In. Roadmap Out.

Drop in our widget to capture user feedback. Watch as AI analyzes all user inputs, uncovers hidden insights, and automatically builds your prioritized roadmap. No manual sorting, no guesswork, just data-driven clarity on what to build next.

Open-source & self-hostable, or available as a cloud-hosted version with a [generous free tier](https://www.feedbackland.com/#pricing).

https://github.com/user-attachments/assets/1b455e94-6117-4ba4-8369-fa2bda2d3590

## How it works

1. 🗣️ The widget collects user feedback directly in-app, at the click of a button.
3. 🤖 AI analyzes the collected feedback, upvotes and comments, uncovers overarching themes and hidden insights, then writes your prioritized roadmap
4. 🚀 You use the roadmap to build the features, and fix the issues, your users find truly important. No guessing required!

## Preview the widget

[Visit Feedbackland's website](https://www.feedbackland.com) to preview & test-drive the widget.

## Embed the widget

Embed Feedbackland in 30 seconds in your React/Nextjs app:

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

Alternatively [get your code snippet](https://www.feedbackland.com/#embed) with a pre-filled `platformId` from the Feedbackland website.

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
