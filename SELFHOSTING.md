# Self-Hosting Feedbackland

Deploy your own instance of Feedbackland. This guide walks you through every step.

## Before You Start

**You will need:**

- A [GitHub](https://github.com) account
- [Git](https://git-scm.com) installed on your computer
- [Node.js 18+](https://nodejs.org) and `npm` installed (for local testing only &mdash; optional)

**You will create free accounts on:**

| Service                                 | What it does                | Free tier                                  |
| --------------------------------------- | --------------------------- | ------------------------------------------ |
| [Supabase](https://supabase.com)        | Database + file storage     | 2 projects, 500 MB                         |
| [Firebase](https://firebase.google.com) | User login (authentication) | Generous free tier                         |
| [OpenRouter](https://openrouter.ai)     | Powers AI features          | Pay-as-you-go (some free models available) |
| [Vercel](https://vercel.com)            | Hosts the app               | Hobby tier is free                         |

> **Tip:** Keep a text editor open as you go. You will collect **10 credentials** across the next steps and paste them all into a single `.env` file before deploying.

---

## Step 1 &mdash; Fork the Code

Forking lets you deploy to Vercel in one click and pull future Feedbackland updates any time.

1. Go to the [Feedbackland repository](https://github.com/feedbackland/feedbackland) on GitHub.
2. Click the **Fork** button (top-right corner).
3. Clone your fork and create your local environment file:

   ```bash
   git clone https://github.com/YOUR_USERNAME/feedbackland.git
   cd feedbackland
   cp .env.example .env
   ```

Open the newly created `.env` file in your editor. You will see this:

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

Leave `SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED` as `true`. You will fill in the remaining 8 values over the next steps.

---

## Step 2 &mdash; Set Up Supabase (Database)

### 2.1 &mdash; Create a Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organization (or create one).
4. Fill in:
   - **Name:** anything you like (e.g. `feedbackland`)
   - **Database Password:** click **Generate a password**, then **copy it and save it somewhere safe**. You will need it in step 2.5.
   - **Region:** pick the one closest to your users.
5. Click **Create new project** and wait for it to finish provisioning (usually about 30 seconds).

### 2.2 &mdash; Enable the Vector Extension

> **CRITICAL — do this before running the schema.** The database schema uses the `halfvec` type from the `vector` extension. If the extension is not enabled first, the schema will fail.

1. In the Supabase sidebar, click **Database**.
2. Click **Extensions**.
3. Search for `vector`.
4. Click the toggle to **enable** it. Leave the schema set to the default (`extensions`).

### 2.3 &mdash; Run the Database Schema

1. Open the file `db/schema.sql` from your local project folder in any text editor. Select all and copy it.
2. In Supabase, click the **SQL Editor** icon in the left sidebar (it looks like a `>_` terminal prompt).
3. Paste the content into the editor.
4. Click **Run** (bottom-right).

You should see `Success. No rows returned` — that means everything worked.

> **What the SQL sets up for you:**
>
> - All database tables, indexes, and foreign keys
> - The `images` storage bucket (created as public so browsers can load uploaded images)
> - Three storage policies that allow image uploads, updates, and deletes
>
> There is nothing else you need to create manually in Supabase Storage. It is all handled by this single SQL script.

If you see an error mentioning `type "extensions.halfvec" does not exist`, the vector extension is not enabled. Go back to Step 2.2.

### 2.4 &mdash; Disable the Data API

Feedbackland connects to the database directly via PostgreSQL and uses the Supabase Storage API for file uploads. It does **not** use the Supabase Data API (PostgREST). Disabling it reduces your attack surface.

1. In the sidebar, click **Project Settings** (gear icon at the bottom).
2. Click **Data API**.
3. Toggle **Enable Data API** to **OFF**.
4. Confirm the change.

### 2.5 &mdash; Collect Your Supabase Credentials

You need three values from Supabase. Collect and paste each one into your `.env` file as you go.

**Project Reference ID:**

1. Go to **Project Settings** → **General**.
2. Copy the **Reference ID** (a short alphanumeric string, e.g. `abcdefghijkl`).

**Anon / Public Key:**

1. Go to **Project Settings** → **API**.
2. Under **Project API keys**, copy the key labeled `anon` `public`.

**Database Connection String:**

1. Click the **Connect** button in the top navigation bar of your project.
2. Select the **Transaction** tab (Transaction Pooler).
3. Copy the connection string. It looks like:
   `postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
4. Replace `[YOUR-PASSWORD]` with the database password you saved in Step 2.1.

**Paste into your `.env` file:**

```env
DATABASE_URL=postgresql://postgres.abcdefghijkl:your-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_PROJECT_ID=abcdefghijkl
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## Step 3 &mdash; Set Up Firebase (Authentication)

### 3.1 &mdash; Create a Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Create a project** (or **Add project**).
3. Give it a name (e.g. `feedbackland`).
4. Follow the prompts. **Tip:** disable Google Analytics when asked — it simplifies setup.
5. Click **Create project**, then **Continue** when it finishes.

### 3.2 &mdash; Register a Web App

1. On the project overview page, click the **Web** icon (`</>`).
2. Enter a nickname (e.g. `feedbackland-web`). You do **not** need to check "Also set up Firebase Hosting".
3. Click **Register app**.
4. Firebase shows you a config object like this:

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

5. Open the file `firebaseConfig.ts` in your project's root folder.
6. Replace the **values** inside the existing config object with your own values. Keep the `export const` line intact. The file should end up looking like this:

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

7. Save the file.

> **Why is it safe to commit an API key to GitHub?**
> Firebase _web_ API keys (`apiKey`, `appId`, etc.) are intentionally public. They are client-side identifiers, not secrets. Firebase protects your project by restricting which domains are allowed to use them — you will configure this in Step 6. The **actual secrets** (private key, client email) go in your `.env` file and are never committed. Committing `firebaseConfig.ts` is correct and intentional.

### 3.3 &mdash; Enable Sign-In Methods

1. In the Firebase sidebar, go to **Build** → **Authentication**.
2. Click **Get started**.
3. Go to the **Sign-in method** tab.
4. Enable the following providers:
   - **Email/Password:** click it → toggle **Enable** → **Save**.
   - **Google:** click it → toggle **Enable** → select a support email → **Save**.

### 3.4 &mdash; Get Admin SDK Credentials

1. Click the **gear icon** (top of sidebar) → **Project settings**.
2. Go to the **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**.
4. A JSON file downloads. Open it in a text editor and find `project_id`, `client_email`, and `private_key`.

Paste them into your `.env` file:

```env
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...your full key here...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

> **Important notes:**
>
> - Wrap `FIREBASE_PRIVATE_KEY` in **double quotes** exactly as shown. The key contains literal `\n` characters which the app handles correctly.
> - For `FIREBASE_DATABASE_URL`, substitute your Firebase project ID into the URL shown above. This value is required by the configuration template; the Firebase Realtime Database feature is not used or needed in self-hosted mode.

---

## Step 4 &mdash; Get an OpenRouter API Key (AI Features)

1. Go to [openrouter.ai](https://openrouter.ai) and sign up.
2. Go to **Keys** in your dashboard, click **Create key**, and copy it.

Paste it into your `.env` file:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## Step 5 &mdash; Deploy to Vercel

### Pre-Deploy Checklist

Before deploying, verify that your `.env` file is complete. All 10 lines should be filled in:

```env
SELF_HOSTED=true
NEXT_PUBLIC_SELF_HOSTED=true
DATABASE_URL=postgresql://...          # from Step 2.5
NEXT_PUBLIC_SUPABASE_PROJECT_ID=...    # from Step 2.5
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # from Step 2.5
OPENROUTER_API_KEY=sk-or-v1-...        # from Step 4
FIREBASE_PROJECT_ID=...                # from Step 3.4
FIREBASE_CLIENT_EMAIL=...              # from Step 3.4
FIREBASE_PRIVATE_KEY="-----BEGIN..."   # from Step 3.4
FIREBASE_DATABASE_URL=https://...      # from Step 3.4
```

If any line is empty, go back to the relevant step.

### Commit Your Firebase Config

You edited `firebaseConfig.ts` in Step 3.2. You must commit and push this change to your GitHub fork before deploying, so Vercel has access to it:

```bash
git add firebaseConfig.ts
git commit -m "Add Firebase config"
git push
```

### Deploy

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** → **Project**.
3. Find and **Import** your forked GitHub repository.
4. Under **Environment Variables**, click inside the **Name** input field of the first empty row.
5. **Paste the entire contents of your `.env` file.** Vercel will automatically detect and parse all key-value pairs from the dotenv format, including the multi-line quoted `FIREBASE_PRIVATE_KEY` value.
6. Verify the 10 variables appear correctly in Vercel's list, then click **Deploy**.
7. Wait for the build to finish (typically 1–2 minutes).

---

## Step 6 &mdash; Authorize Your Vercel Domain in Firebase

After Vercel deploys, it assigns your app a URL such as `your-app.vercel.app`. Firebase blocks login attempts from any domain that isn't explicitly authorized. You must add your Vercel URL now.

1. Copy your Vercel deployment URL (e.g. `your-app.vercel.app`).
2. Return to the [Firebase Console](https://console.firebase.google.com) and open your project.
3. Go to **Build** → **Authentication** → **Settings** → **Authorized domains**.
4. Click **Add domain**.
5. Paste your domain **without** `https://` (e.g. `your-app.vercel.app`).
6. Click **Add**.

> If you later set up a custom domain on Vercel, repeat this step for that domain too.

---

## Step 7 &mdash; Local Development (Optional)

If you want to run Feedbackland on your local machine to make changes or test features:

1. Ensure your `.env` file is completely filled out from the steps above.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

> `localhost` is pre-authorized in Firebase by default, so local sign-in works immediately without any extra configuration.

---

## You're Live

Open your Vercel URL in a browser. The app will redirect you to `/get-started`, where you can create your first organization and admin account.

---

## Troubleshooting

### Build fails on Vercel

- **Missing environment variable:** Open the Vercel project dashboard → **Settings** → **Environment Variables** and confirm all 10 variables are present. A common miss is forgetting `SELF_HOSTED=true` or `NEXT_PUBLIC_SELF_HOSTED=true`.
- **`FIREBASE_PRIVATE_KEY` errors:** The private key must be the full value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`, wrapped in double quotes in the `.env` file. Do not strip newlines or modify the value.

### SQL schema fails in Supabase

- **`type "extensions.halfvec" does not exist`:** The `vector` extension is not enabled. Follow Step 2.2 exactly, then re-run the SQL.
- **Permission errors:** Always run the SQL from the built-in **SQL Editor** inside your Supabase project, not from an external database client or tool.

### Login doesn't work on the deployed app

- **Firebase "auth/unauthorized-domain" error:** You skipped or forgot Step 6. Add your exact Vercel domain (without `https://`) to Firebase → Authentication → Settings → Authorized domains.
- **Google sign-in doesn't redirect back:** Same fix — the domain must be in the authorized list.

### Keeping up with updates

Because you forked the repository (Step 1), you can stay up to date by clicking **Sync Fork** on your GitHub fork page. Vercel will automatically detect the new commits and trigger a fresh deployment.
