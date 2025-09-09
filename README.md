
<img width="2421" height="1454" alt="github_banner_2" src="https://github.com/user-attachments/assets/cd8002b9-e669-47de-aadf-905e96df237a" />

Feedbackland is an open-source, easily-embeddable feedback platform that captures your users' ideas and suggestions directly in your app, then automatically turns them into a prioritized roadmap. So you can ship with data-driven certainty what users love.

## Add Feedbackland to your React or Next.js app in seconds

Install the package
```
npm i feedbackland-react
```

Import the feedback button and place it anywhere in your UI (for example, in a sidebar or menu)
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

Note: You can generate your UUID [here](https://www.uuidtools.com/v4).

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
