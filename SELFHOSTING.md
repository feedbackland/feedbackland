# Self-Hosting Feedbackland

Deploy your own instance of Feedbackland. This guide walks you through every click.

## Before You Start

**You will need:**

- [Git](https://git-scm.com) installed on your computer
- [Node.js 18+](https://nodejs.org) installed (for local testing, optional)
- A [GitHub](https://github.com) account

**You will create free accounts on:**

| Service | What it does | Free tier |
|---|---|---|
| [Supabase](https://supabase.com) | Database + file storage | 2 projects, 500 MB |
| [Firebase](https://firebase.google.com) | User login (authentication) | Generous free tier |
| [Resend](https://resend.com) | Sends transactional emails | 3,000 emails/month |
| [OpenRouter](https://openrouter.ai) | Powers AI features | Pay-as-you-go (some free models available) |
| [Vercel](https://vercel.com) | Hosts the app | Hobby tier is free |

> All credentials you collect will go into a single `.env` file. Keep a text editor open to paste them as you go.

---

## Step 1 &mdash; Clone the Code

```bash
git clone https://github.com/feedbackland/feedbackland.git
cd feedbackland
cp .env.example .env
```

Open the new `.env` file in your editor. It looks like this:

```env
SELF_HOSTED=true
NEXT_PUBLIC_SELF_HOSTED=true
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_PROJECT_ID=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=
RESEND_EMAIL_SENDER=
OPENROUTER_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Leave `SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED` as `true`. You will fill in the rest over the next steps.

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
5. Click **Create new project** and wait for it to finish provisioning.

### 2.2 &mdash; Enable the Vector Extension

The database schema requires the `vector` extension. You must enable it **before** running the schema.

1. In the Supabase sidebar, click **Database**.
2. Click **Extensions**.
3. Search for `vector`.
4. Click the toggle to **enable** it.

### 2.3 &mdash; Run the Database Schema

1. Open the file `db/schema.sql` from your local project folder in any text editor.
2. Select all the content and copy it.
3. In Supabase, click the **SQL Editor** icon in the sidebar (it looks like a terminal `>`).
4. Paste the content into the editor.
5. Click **Run** (bottom-right).

You should see `Success. No rows returned` — that means it worked. If you see an error mentioning `halfvec` or `vector`, go back to step 2.2 and make sure the vector extension is enabled.

### 2.4 &mdash; Create an Image Storage Bucket

1. In the Supabase sidebar, click **Storage**.
2. Click **New bucket**.
3. Set the **Name** to exactly: `images`
4. Toggle **Public bucket** to **ON**.
5. Click **Create bucket**.

### 2.5 &mdash; Disable the Data API

Feedbackland connects to the database directly and does not use the Supabase Data API. Disabling it reduces your attack surface.

1. In the sidebar, click **Project Settings** (gear icon at the bottom).
2. Click **Data API**.
3. Toggle **Enable Data API** to **OFF**.
4. Confirm the change.

### 2.6 &mdash; Collect Your Supabase Credentials

You need three values. Here is exactly where to find each one:

**Project Reference ID:**
1. Go to **Project Settings** > **General**.
2. Look for **Reference ID** (a short string like `abcdefghijkl`).
3. Copy it.

**Anon / Public Key:**
1. Go to **Project Settings** > **API Keys**.
2. Copy the key labeled `anon` `public`.

**Database Connection String:**
1. Click the **Connect** button in the top navigation bar.
2. Select **Transaction Pooler**.
3. Copy the connection string. It looks like this:
   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the database password you saved in step 2.1.

**Paste into your `.env` file:**

```env
NEXT_PUBLIC_SUPABASE_PROJECT_ID=abcdefghijkl
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
DATABASE_URL=postgresql://postgres.abcdefghijkl:YOUR_ACTUAL_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

> **Checkpoint:** You now have 3 of 8 values filled in.

---

## Step 3 &mdash; Set Up Firebase (Authentication)

### 3.1 &mdash; Create a Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Create a project** (or **Add project**).
3. Give it a name (e.g. `feedbackland`).
4. Follow the prompts (you can disable Google Analytics if you don't need it).
5. Click **Create project**, then **Continue** when it finishes.

### 3.2 &mdash; Register a Web App

1. On the project overview page, click the **Web** icon (`</>`).
2. Enter a nickname (e.g. `feedbackland-web`).
3. You do **not** need to check "Firebase Hosting".
4. Click **Register app**.
5. Firebase will show you a code block like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. Open the file `firebaseConfig.ts` in your project root.
7. Replace the **values** inside the existing config object with your values. Keep the `export const` line intact. The file should look like:

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

8. Save the file.

### 3.3 &mdash; Enable Sign-In Methods

1. In the Firebase sidebar, go to **Build** > **Authentication**.
2. Click **Get started**.
3. Go to the **Sign-in method** tab.
4. Enable the following providers:

| Provider | Setup |
|---|---|
| **Email/Password** | Click it, toggle **Enable**, click **Save**. |
| **Google** | Click it, toggle **Enable**, select a support email, click **Save**. |
| **Microsoft** *(optional)* | Requires an Azure AD app registration. Skip this if you don't need it. |

### 3.4 &mdash; Get Admin SDK Credentials

1. Click the **gear icon** (top of sidebar) > **Project settings**.
2. Go to the **Service accounts** tab.
3. Click **Generate new private key**, then **Generate key**.
4. A JSON file will download. Open it in a text editor.
5. Find these three fields:

```json
{
  "project_id": "your-project",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv..."
}
```

**Paste into your `.env` file:**

```env
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...your full key here...\n-----END PRIVATE KEY-----\n"
```

> **Important:** Wrap the `FIREBASE_PRIVATE_KEY` value in **double quotes**. The key contains `\n` newline characters that must be preserved.

> **Checkpoint:** You now have 6 of 8 values filled in.

---

## Step 4 &mdash; Get API Keys

### 4.1 &mdash; Resend (Email)

1. Go to [resend.com](https://resend.com) and create an account.
2. Go to **API Keys** ([resend.com/api-keys](https://resend.com/api-keys)).
3. Click **Create API Key**, give it a name, and copy the key.
4. Go to **Domains** ([resend.com/domains](https://resend.com/domains)) and add + verify a domain you own.
   - Resend will ask you to add DNS records (typically TXT and MX). Follow their instructions for your domain registrar.
   - Once verified, the domain status will show a green checkmark.

**Paste into your `.env` file:**

```env
RESEND_API_KEY=re_123abc...
RESEND_EMAIL_SENDER=feedback@your-verified-domain.com
```

> `RESEND_EMAIL_SENDER` must use your verified domain. The format is `anything@your-domain.com`.

### 4.2 &mdash; OpenRouter (AI)

1. Go to [openrouter.ai](https://openrouter.ai) and create an account.
2. Go to **Keys** ([openrouter.ai/keys](https://openrouter.ai/keys)).
3. Click **Create Key**, give it a name, and copy it.

**Paste into your `.env` file:**

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

> **Checkpoint:** All 8 values are filled in. Your `.env` file is complete.

---

## Step 5 &mdash; Deploy to Vercel

### 5.1 &mdash; Push to Your Own GitHub Repo

You need your own copy of the code on GitHub so Vercel can deploy it.

```bash
# Remove the original remote
git remote remove origin

# Add your own repo (create it on github.com/new first)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Commit your config changes and push
git add -A
git commit -m "Configure for self-hosted deployment"
git push -u origin main
```

> If `git push` fails with a branch error, try: `git push -u origin HEAD:main`

### 5.2 &mdash; Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** > **Project**.
3. Find and **Import** your new GitHub repository.
4. Under **Environment Variables**, add every variable from your `.env` file:

   **Quick method:** Copy the entire contents of your `.env` file. Click the first input field in Vercel's environment variables section, then paste. Vercel will auto-detect and populate all key-value pairs.

   **Manual method:** Add each variable one by one.

   Make sure these are all present:

   | Variable | Example Value |
   |---|---|
   | `SELF_HOSTED` | `true` |
   | `NEXT_PUBLIC_SELF_HOSTED` | `true` |
   | `DATABASE_URL` | `postgresql://postgres.abc:pass@...` |
   | `NEXT_PUBLIC_SUPABASE_PROJECT_ID` | `abcdefghijkl` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` |
   | `RESEND_API_KEY` | `re_123abc...` |
   | `RESEND_EMAIL_SENDER` | `feedback@yourdomain.com` |
   | `OPENROUTER_API_KEY` | `sk-or-v1-...` |
   | `FIREBASE_PROJECT_ID` | `your-project` |
   | `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-...@...iam...` |
   | `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` |

5. Click **Deploy** and wait for the build to finish.

---

## Step 6 &mdash; Authorize Your Domain in Firebase

After Vercel deploys, it assigns your app a URL (e.g. `your-app.vercel.app`).

1. Copy your Vercel URL from the deployment page.
2. Go back to the [Firebase Console](https://console.firebase.google.com).
3. Navigate to **Authentication** > **Settings** > **Authorized domains**.
4. Click **Add domain**.
5. Paste your Vercel domain **without** `https://` (e.g. `your-app.vercel.app`).
6. Click **Add**.

> Without this step, Firebase will block login attempts from your deployed app.

---

## You're Live

Open your Vercel URL in a browser. You will be redirected to `/get-started` where you can create your first organization and admin account.

---

## Troubleshooting

### Build fails on Vercel

- **Missing environment variable:** Check that all 11 variables from the table in Step 5.2 are set. A common miss is forgetting `SELF_HOSTED=true` or `NEXT_PUBLIC_SELF_HOSTED=true`.
- **`FIREBASE_PRIVATE_KEY` errors:** Make sure the entire key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) is pasted as one continuous value. In Vercel, do not add extra quotes around the value &mdash; Vercel handles the escaping.

### SQL schema fails in Supabase

- **`type "halfvec" does not exist`:** The `vector` extension is not enabled. Go back to Step 2.2.
- **Permission errors:** Make sure you are running the SQL in the built-in SQL Editor, not an external tool.

### Login doesn't work on the deployed app

- **Firebase "unauthorized domain" error:** You forgot Step 6. Add your Vercel domain to Firebase's authorized domains list.
- **Google sign-in doesn't redirect back:** Same fix &mdash; add the domain in Firebase.

### Emails not sending

- **Resend domain not verified:** Go to [resend.com/domains](https://resend.com/domains) and check the domain status. DNS propagation can sometimes take up to 48 hours.
- **Wrong sender format:** `RESEND_EMAIL_SENDER` must be an email address on your verified domain (e.g. `noreply@yourdomain.com`), not a random address.

### Custom domain

To use a custom domain instead of `*.vercel.app`:

1. Add the domain in **Vercel** > **Project Settings** > **Domains**.
2. Add the same domain in **Firebase** > **Authentication** > **Settings** > **Authorized domains**.
