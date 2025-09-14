
<img width="2421" height="1267" alt="github_banner_7" src="https://github.com/user-attachments/assets/d8c2a31d-f184-4516-b5b0-36a47ca14c0b" />

Feedbackland is a drop-in, open-source feedback button for your React or Next.js app that captures user ideas, issues, and suggestions, then uses AI to generate a prioritized roadmap. So you always know exactly what to build next, based on real user needs.

## Add the feedback button to your React or Next.js app

```
npm i feedbackland-react
```

```
import { FeedbackButton } from 'feedbackland-react';
```

```tsx
<FeedbackButton
  platformId="A-RANDOMLY-GENERATED-UUIDV4" // get one here: https://www.uuidtools.com/v4
  mode="light" // the color mode of the widget, 'light' or 'dark'
  button={<button>Feedback</button>} // bring your own button, or a button from your favorite component library
/>
```

## Self-host Feedbackland

[Go to the docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Contact us

[Send us an email](mailto:hello@feedbackland.com)

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform](https://dogfood.feedbackland.com)!

For technical and code-related issues, ideas & discussions, please feel free to use this repository's [Issues section](https://github.com/feedbackland/feedbackland/issues).

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
