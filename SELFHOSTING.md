# Self-Hosting Feedbackland

Deploy your own instance — your data, your domain, your costs.

This guide is a sequence of small, verifiable steps. Follow them in order
and you will end up with a running Feedbackland on your own Vercel project,
backed by your own Supabase database and Firebase auth. **Allow ~15 minutes.**

## What you're building

```
                  ┌───────────────────────────┐
                  │   Vercel (Next.js host)   │
                  └─────────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
  ┌───────────┐         ┌───────────────┐       ┌──────────────┐
  │ Supabase  │         │   Firebase    │       │  OpenRouter  │
  │ Postgres  │         │     Auth      │       │     LLM      │
  │ + Storage │         │ (Google/email)│       │   provider   │
  └───────────┘         └───────────────┘       └──────────────┘
```

Four services, all free to start. You'll gather **10 environment values**
across them, paste them into Vercel, and ship.

## Before you start

**On your machine:**

- A [GitHub](https://github.com) account
- [Git](https://git-scm.com) installed
- *(Optional, for local testing only)* [Node.js 20+](https://nodejs.org) and `npm`

**Accounts you'll create (all free):**

| Service                                 | What it does                | Free tier                                                      |
| --------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| [Supabase](https://supabase.com)        | Postgres database + image storage | 2 projects · 500 MB DB · 1 GB storage · 50k monthly auth users |
| [Firebase](https://firebase.google.com) | User authentication         | Generous Spark plan, no credit card required                   |
| [OpenRouter](https://openrouter.ai)     | LLM for AI roadmap, search, rewrite | Pay-as-you-go · free models available                    |
| [Vercel](https://vercel.com)            | Hosts the Next.js app       | Hobby plan is free for non-commercial use                      |

> [!IMPORTANT]
> **Supabase free-tier projects pause after 7 days of inactivity.** Paused
> projects don't auto-wake — you have to click **Restore project** in the
> Supabase dashboard before they accept requests again. For a board that
> sees regular use this won't trigger. If you expect long quiet stretches,
> consider upgrading the project to Pro or pinging the database on a
> schedule.

> [!TIP]
> Keep a scratch text editor open as you go. You'll collect **10 values**
> across the next steps and paste them all into a single `.env` file before
> deploying.

---

## Step 1 — Fork the repository

Forking gives you your own copy and a one-click path to redeploy when
Feedbackland ships updates.

1. Go to the [Feedbackland repository](https://github.com/feedbackland/feedbackland).
2. Click **Fork** (top-right). Use the defaults.
3. Clone your fork locally and create an empty `.env`:

   ```bash
   git clone https://github.com/YOUR_USERNAME/feedbackland.git
   cd feedbackland
   cp .env.example .env
   ```

Open the new `.env` file. It should look like this:

```env
SELF_HOSTED=true
NEXT_PUBLIC_SELF_HOSTED=true
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_PROJECT_ID=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=""
FIREBASE_DATABASE_URL=
```

Leave the two `SELF_HOSTED` lines as `true`. You'll fill the other 8 values
in the steps below.

---

## Step 2 — Set up Supabase (Postgres + storage)

### 2.1 — Create a project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Fill in:
   - **Name:** anything (e.g. `feedbackland`)
   - **Database Password:** click **Generate a password** and **save it
     somewhere safe right now** — you'll need it in step 2.5.
   - **Region:** the one closest to your users.
4. Click **Create new project**. Provisioning takes ~30 seconds.

### 2.2 — Enable the `vector` extension (do this first!)

> [!WARNING]
> **Do this before running the schema.** The schema uses Postgres'
> `halfvec` type (for semantic search). If the `vector` extension isn't
> enabled first, the schema will fail.

1. In the Supabase sidebar, click **Database** → **Extensions**.
2. Search for **`vector`**.
3. Click the toggle to enable it. Keep the schema set to the default
   (`extensions`).

### 2.3 — Run the database schema

1. Open `db/schema.sql` from your local clone in any text editor. Select
   everything and copy.
2. Back in Supabase, click the **SQL Editor** in the sidebar (the `>_` icon).
3. Paste the SQL into the editor.
4. Click **Run** (bottom-right, or `Ctrl/Cmd+Enter`).

You should see **"Success. No rows returned"** — that's the all-clear.

> **What this script does for you:**
>
> - Creates every table, index, foreign key, and enum the app needs.
> - Creates a public `images` storage bucket so uploaded screenshots are
>   reachable from a browser.
> - Adds three policies on that bucket allowing upload / update / delete.
>
> You don't need to touch Supabase Storage manually — the script handles it.

**If you see `type "extensions.halfvec" does not exist`**, the vector
extension isn't on. Go back to step 2.2, then re-run the SQL.

### 2.4 — Disable the Data API (recommended)

Feedbackland talks to Postgres directly and uses Supabase Storage for
images. It does **not** use Supabase's REST Data API (PostgREST), so you
can switch it off to shrink your attack surface.

1. **Project Settings** (gear icon) → **Data API**.
2. Toggle **Enable Data API** to **off** and confirm.

### 2.5 — Collect three Supabase values

You need three things from Supabase. Add each one to your `.env` as you go.

| Value                                | Where to find it                                                       |
| ------------------------------------ | ---------------------------------------------------------------------- |
| **Project Reference ID**             | Project Settings → General → **Reference ID** (short alphanumeric)     |
| **`anon` / `public` API key**        | Project Settings → API → **`anon` `public`** under Project API keys    |
| **Transaction-pooler connection string** | Click **Connect** at the top of any project page → **Transaction** tab |

The connection string looks like:

```
postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

Replace `[YOUR-PASSWORD]` with the database password from step 2.1.

**Paste into `.env`:**

```env
DATABASE_URL=postgresql://postgres.abcdefghijkl:your-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_PROJECT_ID=abcdefghijkl
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## Step 3 — Set up Firebase (authentication)

### 3.1 — Create a project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Create a project** (or **Add project**).
3. Name it (e.g. `feedbackland`).
4. **Disable Google Analytics** when prompted — it simplifies setup and
   Feedbackland doesn't use it.
5. Click **Create project**, then **Continue** when it finishes.

### 3.2 — Register a web app and wire in its config

1. On the project overview, click the **Web** icon (`</>`).
2. Give it a nickname (e.g. `feedbackland-web`). **Do not** check
   "Also set up Firebase Hosting."
3. Click **Register app**. Firebase shows a snippet like:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
   };
   ```

4. Open `firebaseConfig.ts` at the **root of your local repo** and replace
   the existing values with your own:

   ```ts
   export const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT",
     storageBucket: "YOUR_PROJECT.firebasestorage.app",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID",
   };
   ```

5. Save. **Keep the `export const firebaseConfig` line intact** — only the
   values change.

> **Is it safe to commit this file?** Yes. Firebase web API keys are
> intentionally public — they're client-side identifiers, not secrets.
> Firebase protects your project by restricting which domains may use them
> (you'll lock that down in step 7). The **real secrets** (private key,
> client email) go into your `.env` and are never committed.

### 3.3 — Enable sign-in methods

1. Sidebar → **Build** → **Authentication** → **Get started**.
2. Open the **Sign-in method** tab.
3. Enable each provider you want:
   - **Email/Password** — click it, toggle **Enable**, **Save**.
   - **Google** — click it, toggle **Enable**, pick a support email, **Save**.
   - *(Optional)* **Microsoft** — supported by the app, but enabling it
     in Firebase requires registering an OAuth application in **Microsoft
     Entra** (Azure AD) and pasting its client ID + secret back here.
     Skip unless you need Microsoft SSO; see Firebase's
     [Microsoft provider docs](https://firebase.google.com/docs/auth/web/microsoft-oauth)
     if you do.

### 3.4 — Generate Admin SDK credentials

1. Sidebar **gear icon** → **Project settings** → **Service accounts** tab.
2. Click **Generate new private key**, confirm. A JSON file downloads.
3. Open the downloaded JSON. Find `project_id`, `client_email`, and
   `private_key`.

**Paste into `.env`:**

```env
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...your full key here...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

> [!IMPORTANT]
> - **`FIREBASE_PRIVATE_KEY` must be wrapped in double quotes.** The
>   literal `\n` characters inside (two-character escapes, not actual
>   newlines) are handled by the app at runtime.
> - **`FIREBASE_DATABASE_URL` is required by the config but unused in
>   self-hosted mode.** Substitute your Firebase project ID into the URL
>   shown above — any valid-looking value works because Feedbackland skips
>   the Realtime Database when `SELF_HOSTED=true`.

---

## Step 4 — Get an OpenRouter API key

1. Go to [openrouter.ai](https://openrouter.ai) and sign up.
2. Open **Keys** in your dashboard → **Create key** → copy it.

**Paste into `.env`:**

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

> OpenRouter is pay-as-you-go with several free-tier models. Feedbackland's
> defaults are cheap; expect single-digit cents for a typical small board.

---

## Step 5 — Verify your `.env` is complete

Before deploying, your `.env` should have **all 10 lines filled**:

```env
SELF_HOSTED=true                       # left as-is
NEXT_PUBLIC_SELF_HOSTED=true           # left as-is
DATABASE_URL=postgresql://...          # step 2.5
NEXT_PUBLIC_SUPABASE_PROJECT_ID=...    # step 2.5
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # step 2.5
OPENROUTER_API_KEY=sk-or-v1-...        # step 4
FIREBASE_PROJECT_ID=...                # step 3.4
FIREBASE_CLIENT_EMAIL=...              # step 3.4
FIREBASE_PRIVATE_KEY="-----BEGIN..."   # step 3.4 — quoted, with literal \n's
FIREBASE_DATABASE_URL=https://...      # step 3.4
```

Any empty line means you missed a step — go back and finish it before
proceeding.

---

## Step 6 — Deploy to Vercel

### 6.1 — Commit your Firebase config

You edited `firebaseConfig.ts` in step 3.2. Vercel deploys from GitHub, so
that change has to be pushed before deploying:

```bash
git add firebaseConfig.ts
git commit -m "Configure Firebase web app"
git push
```

### 6.2 — Import the project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New** → **Project**.
3. Find and **Import** your forked repository.
4. Leave the Framework Preset on **Next.js**. No build settings need to
   change.

### 6.3 — Paste your env vars in one shot

Vercel auto-parses `.env`-formatted text pasted into its environment
variable form.

1. Scroll to **Environment Variables**.
2. Click inside the **Name** field of the first empty row.
3. **Paste the entire contents of your `.env` file.** Vercel detects all
   10 key-value pairs in one go — the long quoted `FIREBASE_PRIVATE_KEY`
   stays as a single value with its `\n` escapes intact.
4. Confirm all 10 variables are listed correctly.
5. Click **Deploy**.

The build typically takes 2–4 minutes (the embeddable widget workspace
builds first, then Next.js). You'll see a "Congratulations" screen with
your deployment URL when it's done.

---

## Step 7 — Authorize your domain in Firebase

After Vercel deploys, your app lives at something like
`your-app.vercel.app`. Firebase blocks sign-in attempts from any domain
that isn't on its allowlist, so you need to add the Vercel domain now.

1. Copy your Vercel deployment URL.
2. Back in the [Firebase Console](https://console.firebase.google.com),
   open your project.
3. **Build** → **Authentication** → **Settings** tab → **Authorized
   domains**.
4. **Add domain**. Paste your URL **without** `https://` (e.g.
   `your-app.vercel.app`). Click **Add**.

If you add a custom domain to Vercel later, repeat this step for it too.

---

## Step 8 — Create your first organization

The onboarding lives at a fixed path; the root URL isn't mapped to
anything in self-hosted mode.

1. **Go to `<your-vercel-url>/get-started`** (e.g.
   `https://your-app.vercel.app/get-started`).
2. Enter your **product/organization name**. The form auto-fills a URL
   slug from it — this becomes the path segment your board lives at
   (e.g. `your-app.vercel.app/my-org`). Edit it if you prefer something
   else; lowercase letters / digits / hyphens only.
3. Click **Create platform**. The app creates an *unclaimed* organization
   and redirects you to `<your-vercel-url>/<your-org>/claim`.
4. On the claim screen, **sign up with the provider** you enabled in
   step 3.3 (Google, Email/Password, or Microsoft). The account you sign
   in with becomes the org's first admin.
5. You'll see a short widget-integration step (optional — you can wire
   up the embeddable widget later). Click **Proceed to your platform**.
6. Land on your new feedback board, signed in as admin.

🎉 That's it — your instance is live. Bookmark the board URL; from now
on open it directly. `/get-started` is one-time only.

---

## Optional — Use a custom domain

1. In Vercel, open the project's **Domains** tab.
2. Add your domain and follow Vercel's DNS instructions.
3. Once it resolves, repeat **Step 7** to add the new domain to Firebase's
   authorized list. Otherwise sign-in will fail on the new domain.

## Optional — Local development

If you want to run Feedbackland locally to test changes:

```bash
npm install
npm run widget-dev
```

Then open <http://localhost:3000>. `localhost` is automatically authorized
by Firebase, so sign-in works immediately without any extra config.

> [!NOTE]
> Use `npm run widget-dev` (not `npm run dev`) the first time. The repo
> ships the embeddable React widget as a workspace at `feedbackland-react/`,
> and Next.js imports its built output from `feedbackland-react/dist/`.
> That `dist/` is gitignored, so on a fresh clone it doesn't exist yet —
> `npm run dev` alone will fail with a `feedbackland-react` import error.
> `npm run widget-dev` builds the widget in watch mode alongside the Next
> dev server, so everything works from a clean checkout. After the first
> build you can switch to plain `npm run dev` until you next change the
> widget.

> Local dev shares the same Supabase / Firebase / OpenRouter setup as your
> deployed instance — so changes you make through the local UI hit the
> production database. If that's not what you want, create a second
> Supabase project for development and swap the credentials.

## Staying up to date

When Feedbackland ships new releases, pull them into your fork:

1. On your GitHub fork page, click **Sync fork** → **Update branch**.
2. Vercel detects the new commit and rebuilds automatically.

For breaking changes, check the
[Releases](https://github.com/feedbackland/feedbackland/releases) page for
migration notes.

---

## Troubleshooting

### Build fails on Vercel

- **`Missing environment variable: ...`** — Project dashboard →
  **Settings** → **Environment Variables**. All 10 must be present. The
  most-missed ones are `SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED`.
- **`Firebase: Error (auth/invalid-credential)` during build** —
  `FIREBASE_PRIVATE_KEY` is malformed. It must include the full value from
  `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----` and remain
  wrapped in double quotes. Don't strip or alter the `\n` sequences.

### SQL schema fails in Supabase

- **`type "extensions.halfvec" does not exist`** — The `vector` extension
  isn't enabled. Repeat step 2.2 exactly, then **reset the database**
  (see next bullet) and re-run the SQL.
- **`type "..." already exists` / `relation "..." already exists`** on a
  re-run — The schema's `CREATE TYPE` / `CREATE INDEX` / `CREATE POLICY`
  statements aren't idempotent. If your first run failed partway through,
  you can't just run it again. Easiest reset: in the Supabase SQL Editor,
  run this once, then paste in the schema again:
  ```sql
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  DELETE FROM storage.buckets WHERE id = 'images';
  DROP POLICY IF EXISTS "Allow anon uploads"  ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon updates"  ON storage.objects;
  DROP POLICY IF EXISTS "Allow anon deletes"  ON storage.objects;
  ```
  Alternatively, delete the Supabase project from its dashboard and
  start a new one (free-tier projects are fast to recreate).
- **Permission errors** — Always run the SQL from Supabase's built-in
  **SQL Editor**, not from an external client. The web editor runs as
  superuser; external clients usually don't.

### Sign-in doesn't work in production

- **`auth/unauthorized-domain` error** — You skipped or forgot step 7.
  Add your exact Vercel domain (no `https://` prefix) under Firebase
  → Authentication → Settings → Authorized domains.
- **Google popup closes without signing in** — Same fix: missing
  authorized domain.
- **Sign-in tries to authenticate against the wrong Firebase project**
  (e.g. you see Feedbackland's demo account picker, or `auth/api-key-not-valid`)
  — You forgot to commit your edited `firebaseConfig.ts` (step 6.1).
  Vercel built the app with the repo's default config. Push the file:
  ```bash
  git add firebaseConfig.ts
  git commit -m "Configure Firebase web app"
  git push
  ```
  Vercel will redeploy automatically.

### "Supabase project is paused"

Free-tier projects pause after 7 days with no requests, and the app will
fail to reach the database while a project is paused. Open the Supabase
dashboard, click your project, and use the **Restore project** button.
After a minute it'll accept requests again.

### Image uploads fail

Re-run the SQL from step 2.3 — the storage bucket and its policies are
created at the bottom of that script. If you ran a partial schema or
copied only the table definitions, the bucket may be missing.

### Visiting the root URL shows a 404

This is expected on a fresh self-hosted deploy. The root path is not
mapped to anything in the app — the homepage lives at
`/<your-org-subdomain>` (created in step 8), and the onboarding page
lives at `/get-started`. After you create your first organization, you'll
access the board at `<your-vercel-url>/<your-org-subdomain>`.

### Local `npm run dev` fails with `Cannot find module 'feedbackland-react/dist/...'`

On a first run, use `npm run widget-dev` instead — it builds the
embeddable widget workspace (whose `dist/` is gitignored) alongside the
Next dev server. See the **Optional — Local development** section above.

### Postgres connection fails with an SSL or TLS error

Some networks reject unencrypted Postgres connections. If you see
`The server does not support SSL` or similar at deploy time, append
`?sslmode=require` to the end of your `DATABASE_URL` and redeploy:

```
postgresql://postgres.ref:pwd@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
```

This is rarely needed — Supabase's Transaction Pooler accepts the
default unsecured handshake from most providers including Vercel — but
it's the first thing to try if you hit a TLS-related connection error.

### Anything else

Open a [Discussion](https://github.com/feedbackland/feedbackland/discussions)
or [Issue](https://github.com/feedbackland/feedbackland/issues) — happy to
help.
