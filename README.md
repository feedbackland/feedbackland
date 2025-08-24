# Feedbackland - Turn feedback into your roadmap

Feedbackland provides an easy-to-embed React widget for collecting feature requests, bug reports, and any other feedback directly in your app. Then our AI aggregates and analyzes all user inputs, discovers overarching themes & patterns, and creates your prioritized, actionable product roadmap. So you can build with certainty what users really want. No guessing required!

Open-source & self-hostable, or available as a start-free cloud-hosted version embedded in 30 seconds.

https://github.com/user-attachments/assets/3167896a-d564-4e52-8134-e5d10241bdbd

## How it works

1. 🗣️ The widget collects feature requests, bug reports and any other feedback directly in-app
2. ⬆️ Your users vote and comment on feedback to highlight top ideas and important issues.
3. 🤖 Our AI analyzes, clusters & interprets all user inputs, discovers overarching themes and writes your prioritized roadmap
4. 🚀 You use the roadmap to build with certainty what users really want. No guessing required!

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
  mode="" // optional, 'dark' or 'light', defaults to 'dark'
  text="" // optional, the copy text of the button, defaults to 'Feedback'
  className="" // optional, style the button with Tailwind
  style={} // optional, style the button with native CSS
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
