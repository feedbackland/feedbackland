
<img width="2421" height="1315" alt="github_banner_6" src="https://github.com/user-attachments/assets/22d38bf1-8914-4560-a97d-5da84ac10848" />

Feedbackland is an open-source, easily-embeddable feedback platform that captures your users' ideas and suggestions directly in your app, then automatically turns them into a prioritized roadmap.

## Get started

1. Install the package
```
npm i feedbackland-react
```

2. Import the feedback button and place it anywhere in your UI (for example, in a sidebar or menu)
```
import { FeedbackButton } from 'feedbackland-react';
```

```tsx
<FeedbackButton 
  platformId="<A-RANDOMLY-GENERATED-UUIDV4>" // generate one here: https://www.uuidtools.com/v4
  mode="light" // the color mode of the widget, 'light' or 'dark'
  copy="Feedback" // the text of the button
  className="" // style the button with Tailwind
  style={} // or style it with CSS
/>
```

3. Deploy your app to start collecting feedback. Then, generate your first roadmap.

## Self-host Feedbackland

[Go to the docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Contact us

[Send us an email](mailto:hello@feedbackland.com)

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform](https://dogfood.feedbackland.com)!

For technical and code-related issues, ideas & discussions, please feel free to use this repository's [Issues section](https://github.com/feedbackland/feedbackland/issues).

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
