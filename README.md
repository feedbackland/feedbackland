# Feedbackland

<img width="2473" height="1263" alt="Frame 596" src="https://github.com/user-attachments/assets/e3021fd6-c606-4a2f-984f-3ff8cc2f3e1e" />

## How it works

🗣️ The widget collects feedback – Embed our React widget and capture user feedback directly in-app.

⬆️ Your users surface top ideas - Users vote and comment on feedback to identify the most important ideas, issues and requests.

🤖 AI writes your roadmap – AI analyzes and clusters feedback, votes, and comments, then turns them into a prioritized roadmap.

🚀 You build what users love — Use the roadmap to build the features your users will love.

&nbsp;
&nbsp;

## Get started

Follow the step below to embed the widget in your React app in a matter of seconds

1. Install the `feedbackland-react` package
```
npm i feedbackland-react
```
2. Place the `FeedbackButton` anywhere in your app (for example, in a sidebar or top menu bar)
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

Not interested in the widget? No problem, you can also [start with the standalone platform](https://get-started.feedbackland.com).

&nbsp;
&nbsp;

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
