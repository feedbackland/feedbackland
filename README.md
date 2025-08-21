# Feedbackland

<img width="2473" height="1221" alt="Frame 596" src="https://github.com/user-attachments/assets/ef993b79-1d91-45a0-9b01-92530df90093" />

&nbsp;

## About

FeedbackLand is an open-source, self-hostable feedback platform. It includes a React widget to capture feedback directly in your app and uses AI to produce a prioritized roadmap that shows exactly which features and bug fixes your users want.

&nbsp;
&nbsp;

## How it works

🗣️ The Widget Captures Feedback – Embed our React widget and capture user feedback directly in-app.

🤖 AI Writes Your Roadmap – AI analyzes, clusters and transforms feedback into your prioritized roadmap.

🚀 You Build What Your Users Love — Use the roadmap to build the features your users will love.

&nbsp;
&nbsp;

## Embed the widget in 30 seconds
   
1. Install the `feedbackland-react` package
```
npm i feedbackland-react
```
2. Copy-paste the `FeedbackButton` snippet into your React app (e.g. inside of your UI's sidebar or menu)
```tsx
import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="<YOUR-GENERATED-UUID-V4>" //go to www.uuidtools.com/v4 to generate your UUID
  mode="" // 'dark' or 'light', defaults to 'dark'
  text="" // the copy text of the button, defaults to 'Feedback'
  className="" // style the button with Tailwind
  style="" // or style it with native CSS
  button={} // or bring your own button
/>
```
3. Set the `platformId` prop to a new [randomly generated UUID v4](https://www.uuidtools.com/v4). This will be your platform's identifier.

4. Deploy your app, start collecting feedback and generate your first roadmap!

&nbsp;
&nbsp;

## Standalone platform

Not interested in the widget? No problem, you can also [start with the standalone platform](https://get-started.feedbackland.com).

## Self-host it

Want to self-host your Feedbackland platform? [Visit the self-hosting docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

&nbsp;
&nbsp;

## Contact us

Have a question or need support? We're here to help. [hello@feedbackland.com](mailto:hello@feedbackland.com)

&nbsp;
&nbsp;

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform!](https://dogfood.feedbackland.com)

&nbsp;
&nbsp;

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
