# Self-Hosting Guide

Deploy your own instance of Feedbackland in about 30 minutes.

---

## Prerequisites

You'll need accounts with these six services:

| Service | Purpose |
|---------|---------|
| [Supabase](https://supabase.com) | Database and image storage |
| [Firebase](https://firebase.google.com) | User authentication |
| [Resend](https://resend.com) | Transactional emails |
| [OpenRouter](https://openrouter.ai) | AI features |
| [GitHub](https://github.com) | Code repository |
| [Vercel](https://vercel.com) | Hosting |

You'll also need:
- [Git](https://git-scm.com/) installed on your machine
- [psql](https://www.postgresql.org/download/) (PostgreSQL client) installed on your machine

---

## Step 1: Download the Source Code

Clone the repository and set up your environment file:
```bash
git clone https://github.com/feedbackland/feedbackland.git
cd feedbackland
mv .env.example .env
```

You'll populate the `.env` file with credentials as you complete the following steps.

---

## Step 2: Set Up Supabase

### 2.1 Create your project

1. Go to [Supabase](https://supabase.com) and create a new project.
2. Save your database password somewhere safe—you'll need it shortly.

### 2.2 Enable the vector extension

1. Go to **Database → Extensions**.
2. Search for `vector`.
3. Click to enable it.

### 2.3 Disable the Data API

1. Go to **Project Settings → Data API**.
2. Under **Config**, toggle OFF **Enable Data API**.

### 2.4 Create a storage bucket

1. Go to **Storage** in the sidebar.
2. Click **New bucket**.
3. Name it `images`.
4. Toggle ON **Public bucket**.
5. Click **Create bucket**.

### 2.5 Run the database schema

1. Click the **Connect** button in the top bar.
2. Copy the **Direct connection** string.
3. Replace `[YOUR-PASSWORD]` with your actual database password.
4. Run this command in your terminal:
```bash
psql --single-transaction --variable ON_ERROR_STOP=1 --file db/schema.sql "YOUR_CONNECTION_STRING"
```

### 2.6 Add credentials to your `.env` file

Open your `.env` file and fill in these three values:

**DATABASE_URL**
1. Click **Connect** in the top bar.
2. Copy the **Transaction pooler** connection string.
3. Replace `[YOUR-PASSWORD]` with your database password.
4. Paste into your `.env` file.

**NEXT_PUBLIC_SUPABASE_PROJECT_ID**
1. Go to **Project Settings → General**.
2. Copy the **Project ID**.
3. Paste into your `.env` file.

**NEXT_PUBLIC_SUPABASE_ANON_KEY**
1. Go to **Project Settings → API Keys**.
2. Copy the `anon` **public** key.
3. Paste into your `.env` file.

---

## Step 3: Set Up Firebase

### 3.1 Create your project

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a new project.

### 3.2 Configure the web app

1. In your Firebase project, click **Add app** and select **Web**.
2. Register your app and copy the config object.
3. Open `firebaseConfig.ts` in your Feedbackland project folder.
4. Replace the existing config object with yours.

### 3.3 Enable authentication

1. Go to **Authentication** in the sidebar.
2. Click **Get started**.
3. Enable these sign-in methods:
   - Email/Password
   - Google
   - Microsoft

### 3.4 Add credentials to your `.env` file

1. Go to **Project Settings → Service accounts**.
2. Click **Generate new private key**.
3. Open the downloaded JSON file.
4. Copy these values into your `.env` file (without the surrounding quotes):

| JSON field | `.env` variable |
|------------|-----------------|
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_PRIVATE_KEY` |

---

## Step 4: Set Up Resend

1. Go to [Resend](https://resend.com) and create an account.
2. Add and verify your email domain (e.g., `mycompany.com`).
3. Generate an API key.
4. Add these values to your `.env` file:
```
RESEND_API_KEY=your_api_key_here
RESEND_EMAIL_SENDER=info@mycompany.com
```

> **Note:** The sender email must belong to the domain you verified.

---

## Step 5: Set Up OpenRouter

1. Go to [OpenRouter](https://openrouter.ai) and create an account.
2. Generate an API key.
3. Add it to your `.env` file:
```
OPENROUTER_API_KEY=your_api_key_here
```

---

## Step 6: Push to GitHub

1. Create a new repository on [GitHub](https://github.com).
2. Connect your local project to your new repository:
```bash
git remote rm origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git add -A
git commit -m "Initial commit"
git push -u origin main
```

---

## Step 7: Deploy to Vercel

### 7.1 Create your deployment

1. Go to [Vercel](https://vercel.com) and click **Add New → Project**.
2. Import your GitHub repository.
3. Before deploying, go to **Environment Variables**.
4. Copy all values from your local `.env` file and add them here.
5. Click **Deploy**.

### 7.2 Authorize the domain in Firebase

1. Once deployment completes, copy your Vercel URL (e.g., `my-app.vercel.app`).
2. Go to your Firebase Console.
3. Navigate to **Authentication → Settings → Authorized domains**.
4. Click **Add domain** and paste your Vercel URL.

---

## Step 8: Complete Setup

1. Open your browser and go to `https://YOUR_PROJECT.vercel.app/get-started`.
2. Follow the setup wizard to finish configuring your platform.

---

## You're Done!

Your self-hosted Feedbackland instance is now live.

**Need help?** Contact us at [hello@feedbackland.com](mailto:hello@feedbackland.com).
