# Feedbackland

Stop guessing what to build. Our open-source React widget collects in-app feedback, and our AI instantly turns it into your prioritized roadmap. So you ship exactly what users want.

<img width="2473" height="1296" alt="Frame 596" src="https://github.com/user-attachments/assets/8c972e35-b4ab-4868-9a6f-147818ac9ec8" />

&nbsp;

## How it Works

🗣️ The Widget Captures Feedback – Embed our React widget and capture user feedback directly in-app.

🤖 AI Writes Your Roadmap – AI analyzes, clusters and transforms feedback into your prioritized roadmap.

🚀 You Build What Your Users Love — Use the roadmap to build the features your users will love.

&nbsp;
&nbsp;

## Embed the widget
   
[Generate a UUID v4](www.uuidtools.com/v4), paste the `FeedbackButton` snippet into your React app (e.g. inside of a sidebar or menu), and replace the value of the `platformId` prop with your generated UUID v4

```tsx
import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="<YOUR-GENERATED-UUID-V4>" // Your generated UUID v4 (go to www.uuidtools.com/v4 to generate your UUID)
  mode="" // 'dark' or 'light', defaults to 'dark'
  text="" // the copy text of the button, defaults to 'Feedback'
  className="" // style the button with Tailwind
  style="" // or style it with native CSS
  button={} // or bring your own button
/>
```

Alternatively visit our website to [get a code snippet that already contains a generated platformId](http://feedbackland.com/#embed)

&nbsp;
&nbsp;

## Self-Host it

[Go to the self-hosting docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

&nbsp;
&nbsp;

## Contact us

[hello@feedbackland.com](hello@feedbackland.com)

&nbsp;
&nbsp;

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform!](https://dogfood.feedbackland.com)

&nbsp;
&nbsp;

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
