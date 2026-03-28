# Self-Hosting Feedbackland

Deploy your own instance of Feedbackland. This guide walks you through every click.

## Before You Start

**You will need:**

- A [GitHub](https://github.com) account
- [Git](https://git-scm.com) installed on your computer
- [Node.js 18+](https://nodejs.org) and `npm` installed (for local testing, optional)

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

## Step 1 &mdash; Fork the Code

To easily deploy to Vercel and stay up-to-date with future Feedbackland updates, you should fork the repository.

1. Go to the [Feedbackland repository](https://github.com/feedbackland/feedbackland) on GitHub.
2. Click the **Fork** button (top right).
3. Clone your new fork to your local machine:

```bash
git clone https://github.com/YOUR_USERNAME/feedbackland.git
cd feedbackland
cp .env.example .env
```

Open the new `.env` file in your editor. Leave `SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED` as `true`. You will fill in the rest over the next steps.

---

## Step 2 &mdash; Set Up Supabase (Database)

### 2.1 &mdash; Create a Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organization (or create one).
4. Fill in:
   - **Name:** anything you like (e.g. `feedbackland`)
   - **Database Password:** click **Generate a password**, then **copy it and save it somewhere safe**. You will need it in step 2.6.
   - **Region:** pick the one closest to your users.
5. Click **Create new project** and wait for it to finish provisioning.

### 2.2 &mdash; Enable the Vector Extension

The database schema requires the `vector` extension (which provides the `halfvec` type). You must enable it **before** running the schema.

1. In the Supabase sidebar, click **Database**.
2. Click **Extensions**.
3. Search for `vector`.
4. Click the toggle to **enable** it. (Leave it on the default `extensions` schema).

### 2.3 &mdash; Run the Database Schema

1. Open the file `db/schema.sql` from your local project folder in any text editor.
2. Select all the content and copy it.
3. In Supabase, click the **SQL Editor** icon in the sidebar (it looks like a terminal `>`).
4. Paste the content into the editor.
5. Click **Run** (bottom-right).

You should see `Success. No rows returned` — that means it worked. If you see an error mentioning `type "extensions.halfvec" does not exist`, go back to step 2.2 and make sure the vector extension is enabled.

### 2.4 &mdash; Create an Image Storage Bucket

1. In the Supabase sidebar, click **Storage**.
2. Click **New bucket**.
3. Set the **Name** to exactly: `images`
4. Toggle **Public bucket** to **ON**.
5. Click **Create bucket**.

> **Note:** The `db/schema.sql` script you ran in Step 2.3 automatically created the security policies (RLS) under the hood to allow generic image uploads to this bucket. Making the bucket public here allows those images to be viewed by the browser.

### 2.5 &mdash; Disable the Data API

Feedbackland connects to the database directly via postgres, and uses the Supabase Storage API for files. Disabling the Data API (PostgREST) reduces your attack surface.

1. In the sidebar, click **Project Settings** (gear icon at the bottom).
2. Click **Data API**.
3. Toggle **Enable Data API** to **OFF**.
4. Confirm the change.

### 2.6 &mdash; Collect Your Supabase Credentials

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
4. Replace `[YOUR-PASSWORD]` exactly with the database password you saved in step 2.1.

**Paste into your `.env` file:**

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_PROJECT_ID=abcdefghijkl
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## Step 3 &mdash; Set Up Firebase (Authentication)

### 3.1 &mdash; Create a Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Create a project** (or **Add project**).
3. Give it a name (e.g. `feedbackland`).
4. Follow the prompts (you can disable Google Analytics).
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
   - **Email/Password**: Click it, toggle **Enable**, click **Save**.
   - **Google**: Click it, toggle **Enable**, select a support email, click **Save**.

### 3.4 &mdash; Get Admin SDK Credentials

1. Click the **gear icon** (top of sidebar) > **Project settings**.
2. Go to the **Service accounts** tab.
3. Click **Generate new private key**, then **Generate key**.
4. A JSON file will download. Open it in a text editor.
5. Find `project_id`, `client_email`, and `private_key` and paste them into your `.env` file:

```env
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...your full key here...\n-----END PRIVATE KEY-----\n"
```

> **Important:** Wrap the `FIREBASE_PRIVATE_KEY` value in **double quotes** in your `.env` file (as shown above).

---

## Step 4 &mdash; Get API Keys

### 4.1 &mdash; Resend (Email)

1. Go to [resend.com](https://resend.com) and create an account.
2. Go to **API Keys** and click **Create API Key**.
3. Go to **Domains**, add + verify a domain you own.
4. Paste the key and sender string into your `.env`:

```env
RESEND_API_KEY=re_123abc...
RESEND_EMAIL_SENDER=feedback@your-verified-domain.com
```

### 4.2 &mdash; OpenRouter (AI)

1. Go to [openrouter.ai](https://openrouter.ai) and create an account.
2. Go to **Keys**, create one, and copy it:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## Step 5 &mdash; Deploy to Vercel

If you've followed the steps closely, your local `.env` file should now be completely filled out with all 11 variables.

Before deploying to Vercel, you must commit and push your modified `firebaseConfig.ts` file to your GitHub fork:

```bash
git add firebaseConfig.ts
git commit -m "Add Firebase config"
git push
```

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** > **Project**.
3. Find and **Import** your forked GitHub repository.
4. Under **Environment Variables**, copy the **entire contents** of your local `.env` file.
5. Click the first variable input box in Vercel and **paste**. Vercel will automatically detect all the key-value pairs. (Because you paste the entire block, Vercel will correctly handle the double quotes wrapping your `FIREBASE_PRIVATE_KEY`).
6. Click **Deploy** and wait for the build to finish.

---

## Step 6 &mdash; Authorize Your Domain in Firebase

After Vercel deploys, it assigns your app a URL (e.g. `your-app.vercel.app`).

1. Copy your Vercel URL.
2. Go back to the [Firebase Console](https://console.firebase.google.com).
3. Navigate to **Authentication** > **Settings** > **Authorized domains**.
4. Click **Add domain**.
5. Paste your Vercel domain **without** `https://` (e.g. `your-app.vercel.app`).
6. Click **Add**.

> Without this step, Firebase will block login attempts from your deployed app.

---

## Step 7 &mdash; Local Development (Optional)

If you wish to run Feedbackland on your local machine to make modifications or test features:

1. Ensure your `.env` file is completely filled out from the above steps.
2. Run `npm install` to download dependencies.
3. Run `npm run dev` to start the local development server.
4. Open `http://localhost:3000` in your browser.
5. _Note: You must also add `localhost` to your Firebase Authorized domains for local login to work._

---

## You're Live

Open your Vercel URL in a browser. You will be redirected to `/get-started` where you can create your first organization and admin account. Let's go!

---

## Troubleshooting

### Build fails on Vercel

- **Missing environment variable:** Check that all variables from your `.env.example` are set. A common miss is forgetting `SELF_HOSTED=true` or `NEXT_PUBLIC_SELF_HOSTED=true`.
- **`FIREBASE_PRIVATE_KEY` errors:** If Vercel logs complain about parsing keys, ensure you pasted the entire exact multiline string. 

### SQL schema fails in Supabase

- **`type "extensions.halfvec" does not exist`:** The `vector` extension is not enabled. Go back to Step 2.2.
- **Permission errors:** Make sure you are running the SQL in the built-in SQL Editor, not an external tool.

### Login doesn't work on the deployed app

- **Firebase "unauthorized domain" error:** You forgot Step 6. Add your Vercel domain to Firebase's authorized domains list.
- **Google sign-in doesn't redirect back:** Same fix &mdash; add the domain in Firebase.

### Upstream updates

- Ensure you Forked the repository (Step 1). To receive updates safely, use the "Sync Fork" button on GitHub, and Vercel will automatically trigger a new deployment for you.
