# Feedbackland

Feedbackland is an open-source, easily embeddable feedback platform. Use it to capture your user's ideas and suggestion directly in your app. Then let AI automatically analyze and transformm all user inputs into a prioritized roadmap.

https://github.com/user-attachments/assets/6992c85b-704c-48a5-b571-131b94d89087

## How it works

1. Add our widget (aka 'the feedback button') to your React or Next.js app in seconds
2. Users click the button to submit ideas and issues. And view, upvote and comment on feedback.
3. AI analyzes all feedback, uncovers patterns and themes, and writes an actionable roadmap.
4. You follow the roadmap to ship what users love. 🚀

## Get started

To start, simply add the snippet below to your React or Next.js app.

```
npm i feedbackland-react
```

```tsx
import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="A-RANDOMLY-GENERATED-UUIDv4" // generate it here: https://www.uuidtools.com/v4
  mode="" // 'dark' or 'light', defaults to 'light'
  text="" // the copy text of the button, defaults to 'Feedback'
  className="" // style the button with Tailwind
  style={} // or style it with native CSS
  button={} // or bring your own button
/>
```

## Built with the following awesome open-source projects

- Shadcn
- Tailwind
- Next.js
- tRPC
- TanStack Query
- Kysely
- Tiptap
- Polar
- React Hook Form
- Zod
- Supabase

## Self-host it

[Go to the docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Contact us

[Send us an email](mailto:hello@feedbackland.com)

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform](https://dogfood.feedbackland.com)!

For technical and code-related issues, ideas & discussions, please feel free to use this repository's [Issues section](https://github.com/feedbackland/feedbackland/issues).

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
