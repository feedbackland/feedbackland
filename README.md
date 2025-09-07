# Feedbackland - The smart feedback button

Feedbackland is an open-source feedback button that captures your users' ideas and suggestions directly in your app. Then, AI analyzes all the collected feedback and automatically turns it into a prioritized roadmap.

https://github.com/user-attachments/assets/6992c85b-704c-48a5-b571-131b94d89087

## Add the feedback button to your app

```
npm i feedbackland-react
```

```tsx
import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="<RANDOMLY-GENERATED-UUIDV4" // generate one here: https://www.uuidtools.com/v4
  mode="" // 'dark' or 'light', defaults to 'light'
  text="" // the copy text of the button, defaults to 'Feedback'
  className="" // style the button with Tailwind
  style={} // or style it with native CSS
  button={} // or bring your own button
/>
```

## Built with the following awesome open-source projects

- [Shadcn](https://github.com/shadcn-ui/ui)
- [Tailwind](https://github.com/tailwindlabs/tailwindcss)
- [Next.js](https://github.com/vercel/next.js)
- [tRPC](https://github.com/trpc/trpc)
- [TanStack Query](https://github.com/TanStack/query)
- [Kysely](https://github.com/kysely-org/kysely)
- [Tiptap](https://github.com/ueberdosis/tiptap)
- [Polar](https://github.com/polarsource/polar)
- [React Hook Form](https://github.com/react-hook-form/react-hook-form)
- [Zod](https://github.com/colinhacks/zod)
- [Supabase](https://github.com/supabase/supabase)

## Self-host Feedbackland

[Go to the docs](https://github.com/feedbackland/feedbackland/blob/main/SELFHOSTING.md)

## Contact us

[Send us an email](mailto:hello@feedbackland.com)

## Provide feedback

Have a feature request, bug report, or any other feedback? [Share it on our own platform](https://dogfood.feedbackland.com)!

For technical and code-related issues, ideas & discussions, please feel free to use this repository's [Issues section](https://github.com/feedbackland/feedbackland/issues).

## License

Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)
