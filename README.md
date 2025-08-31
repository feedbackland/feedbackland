
<img width="2473" height="1374" alt="feedbackland_github_7" src="https://github.com/user-attachments/assets/74c7e736-9f18-4291-bb52-8e722e5bcea2" />

The feedback button for your React or Next.js app. Captures your user's ideas, issues and suggestions, then auto-generates your perfect roadmap.

## Get your feedback button

```
npm i feedbackland-react
```

```tsx
import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="A-RANDOMLY-GENERATED-UUIDv4" // generate it here: https://www.uuidtools.com/v4
  mode="" // 'dark' or 'light', defaults to 'dark'
  text="" // the copy text of the button, defaults to 'Feedback'
  className="" // style the button with Tailwind
  style={} // or style it with native CSS
  button={} // or bring your own button
/>
```

## How it works

1. 💬 The button collects user feedback, votes, and comments right inside your app.

2. 🤖 AI analyzes everything, surfaces hidden insights, and uncovers your roadmap.

3. 🚀 You build what users love

## Self-host it

[Go to the docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Contact us

[Send us an email](mailto:hello@feedbackland.com)

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform](https://dogfood.feedbackland.com)!

For technical and code-related issues, ideas & discussions, please feel free to use this repository's [Issues section](https://github.com/feedbackland/feedbackland/issues).

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
