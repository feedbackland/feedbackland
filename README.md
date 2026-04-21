<div align="center">                                                                                                          
                                                                                                                                
  # Feedbackland                                                                                                                
                                                                                                                                
  **The open-source feedback platform.**                 

  Collect ideas, bugs, and feature requests. An AI clusters them into a ranked roadmap. Embed it anywhere with a one-line       
  widget. Free, MIT-licensed, no limits.
                                                                                                                                
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)                                                 
  [![Self-Hosted](https://img.shields.io/badge/self--hosted-ready-green)](SELFHOSTING.md)
  [![GitHub Release](https://img.shields.io/github/v/release/feedbackland/feedbackland?color=blue)](https://github.com/feedbackl
  and/feedbackland/releases)                                                                                                    
  [![GitHub Discussions](https://img.shields.io/github/discussions/feedbackland/feedbackland?color=blue)](https://github.com/fee
  dbackland/feedbackland/discussions)                                                                                           
  [![GitHub Stars](https://img.shields.io/github/stars/feedbackland/feedbackland?style=social)](https://github.com/feedbackland/
  feedbackland/stargazers)                                                                                                      
                                                         
  [**Create your platform →**](https://get-started.feedbackland.com) · [Live demo](https://demo.feedbackland.com) ·             
  [Website](https://feedbackland.com) · [Self-host](SELFHOSTING.md)
                                                                                                                                
  <br>                                                   

  ![Feedbackland Dashboard](https://github.com/user-attachments/assets/39671ac5-00dd-4197-a591-eba16c210b1d)                    
  
  </div>                                                                                                                        
                                                         
  ---

  ## Why Feedbackland?

  - **Free forever.** The entire hosted product is free. No trial, no freemium tier, no sales call.                             
  - **MIT-licensed.** Fork it, sell it, embed it. No AGPL viral clause.
  - **Widget-native.** One React component and your users post feedback without leaving your app.                               
  - **AI-first.** Duplicates cluster themselves. The roadmap builds itself. You ship.                                           
  - **Self-hostable.** Docker, Vercel, Supabase, or bare metal. Your data, your infra, your call.                               
                                                                                                                                
  No credit card. No seat cap. No per-user pricing — ever.                                                                      
                                                                                                                                
  > [!TIP]                                                                                                                      
  > **Live in under a minute.** [Create your platform](https://get-started.feedbackland.com) — or [try the 
  demo](https://demo.feedbackland.com) first.                                                                                   
   
  ## Features                                                                                                                   
                                                         
  - **Public feedback board** — posts, threaded comments, upvotes, status tracking, search.                                     
  - **Embeddable React widget** — `feedbackland-react` ships a popover and a drawer variant. One-line install.
  - **AI-generated roadmap** — posts cluster by intent, rank by demand, and the roadmap updates as new feedback lands.          
  - **Ask AI** — ask plain-English questions across every post, comment, and upvote.                                            
  - **Admin dashboard** — moderate, tag, respond, and export from a single inbox.                                               
  - **SSO + email auth** — Google, Microsoft, or email/password.                                                                
  - **REST API** — migrate in, pipe posts from your app, export whenever you want.                                              
                                                                                                                                
  ## Install the widget                                                                                                         
                                                                                                                                
  ```bash                                                                                                                       
  npm install feedbackland-react                         
  ```

  ```tsx
  import { FeedbackButton } from "feedbackland-react";

  export function GiveFeedback() {
    return (
      <FeedbackButton platformId="your-platform-id" widget="popover" />                                                         
    );
  }                                                                                                                             
  ```                                                    

  Your users can post feedback without leaving your app.                                                                        
   
  ## Get started                                                                                                                
                                                         
  **Hosted** — live in about a minute. Free forever.                                                                            
  → [get-started.feedbackland.com](https://get-started.feedbackland.com)
                                                                                                                                
  **Self-hosted** — Docker, Vercel, Supabase, or bare metal. Same codebase as the hosted version — no feature-gating.           
  → [Self-Hosting Guide](SELFHOSTING.md)                                                                                        
                                                                                                                                
  **Live demo** — real board, real widget, no signup.                                                                           
  → [demo.feedbackland.com](https://demo.feedbackland.com)
                                                                                                                                
  ## How it compares                                     
                                                                                                                                
  |                              | Feedbackland  | Canny        | Featurebase  | Fider        |                                 
  | ---------------------------- | :-----------: | :----------: | :----------: | :----------: |
  | License                      | **MIT**       | Proprietary  | Proprietary  | AGPL         |                                 
  | Price                        | **Free**      | $99+/mo      | Free (cap)   | $49/mo cloud |                                 
  | Self-hostable                | ✅            | —            | —            | ✅           |                                 
  | User limits                  | **None**      | Per-user     | Seat cap     | None         |                                 
  | Built-in widgets             | ✅            | ✅           | ✅           | —            |                                 
  | AI-generated roadmap         | ✅            | —            | —            | —            |                                 
  | Ask-in-English analytics     | ✅            | —            | Limited      | —            |                                 
  | Hosted setup                 | **<1 min**    | Sales call   | Signup       | Self only    |                                 
                                                                                                                                
  Canny, Featurebase, and Fider are great tools. Feedbackland is for teams who want to own their data and never get a pricing   
  surprise.                                                                                                                     
                                                                                                                                
  <sub>Competitor pricing and licensing accurate at time of writing; check each product's site for current terms.</sub>         
   
  ## Built with                                                                                                                 
                                                         
  [Next.js](https://github.com/vercel/next.js) · [React](https://github.com/facebook/react) ·                                   
  [TypeScript](https://github.com/microsoft/TypeScript) · [PostgreSQL](https://github.com/postgres/postgres) ·
  [tRPC](https://github.com/trpc/trpc) · [Kysely](https://github.com/kysely-org/kysely) · [Tailwind                             
  CSS](https://github.com/tailwindlabs/tailwindcss) · [shadcn/ui](https://github.com/shadcn-ui/ui) ·
  [Tiptap](https://github.com/ueberdosis/tiptap) · [Zod](https://github.com/colinhacks/zod)

  ## Community

  - **Discussions** — [ask questions, share ideas](https://github.com/feedbackland/feedbackland/discussions)                    
  - **Issues** — [file bugs or feature requests](https://github.com/feedbackland/feedbackland/issues)
  - **Releases** — [changelog](https://github.com/feedbackland/feedbackland/releases). We ship regularly.                       
                                                                                                                                
  ## License                                                                                                                    
                                                                                                                                
  [MIT](LICENSE) — do whatever you want with it. 
