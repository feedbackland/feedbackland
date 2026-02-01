# Self-Hosting Feedbackland

Deploy your own instance of Feedbackland in under 15 minutes.

## Prerequisites

You will need accounts with the following services (all offer free tiers):

* **[GitHub](https://github.com)** (Code repository)
* **[Supabase](https://supabase.com)** (Database & Storage)
* **[Firebase](https://firebase.google.com)** (Authentication)
* **[Resend](https://resend.com)** (Transactional Emails)
* **[OpenRouter](https://openrouter.ai)** (AI Features)
* **[Vercel](https://vercel.com)** (Hosting)

---

## Step 1: Get the Code

Clone the repository and prepare your local environment.

\`\`\`bash
git clone https://github.com/feedbackland/feedbackland.git
cd feedbackland
cp .env.example .env
\`\`\`

---

## Step 2: Set Up Supabase (Database)

1.  **Create Project:** Go to [Supabase](https://supabase.com), create a new project, and **copy your Database Password** (you will need it later).
2.  **Enable Vector Extension:**
    * In the sidebar, go to **Database** → **Extensions**.
    * Search for \`vector\`.
    * Enable the \`vector\` extension.
3.  **Run Database Schema:**
    * Open the file \`db/schema.sql\` in your local project folder and copy its entire content.
    * In Supabase, go to the **SQL Editor** (sidebar icon).
    * Paste the content and click **Run**.
4.  **Create Storage Bucket:**
    * Go to **Storage** → **New Bucket**.
    * Name it \`images\`.
    * Toggle **Public bucket** to **ON**.
    * Click **Create bucket**.
5.  **Disable Data API (Security):**
    * Go to **Project Settings** → **Data API**.
    * Toggle **Enable Data API** to **OFF**.
6.  **Get Credentials:**
    * Go to **Project Settings** → **API Keys**.
    * Copy the \`Project URL\` and \`anon\` / \`public\` Key.
    * Go to **Connect** (top bar) → **Transaction Pooler**.
    * Copy the Connection String (Replace \`[YOUR-PASSWORD]\` with the password from step 2.1).

**Update your \`.env\` file:**
\`\`\`env
NEXT_PUBLIC_SUPABASE_PROJECT_ID=[Your Project Reference ID from the URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Your anon public key]
DATABASE_URL=[Your Transaction Pooler connection string]
\`\`\`

---

## Step 3: Set Up Firebase (Authentication)

### 3.1 Create Project & App
1.  Go to the [Firebase Console](https://console.firebase.google.com) and create a project.
2.  Click the **Web** icon (\`</>\`) to add an app. Give it a nickname (e.g., "Feedbackland").
3.  **Important:** You will see a \`const firebaseConfig = { ... }\` object. Copy this object.
4.  Open \`firebaseConfig.ts\` in your local project folder and replace its content with your specific config.

### 3.2 Enable Authentication
1.  Go to **Build** → **Authentication** → **Get Started**.
2.  Select **Sign-in method** and enable:
    * **Email/Password**
    * **Google** (Default configuration is fine for testing).
    * **Microsoft** (Optional: requires Azure setup).

### 3.3 Get Admin Credentials
1.  Go to **Project Settings** (gear icon) → **Service accounts**.
2.  Click **Generate new private key**.
3.  Open the downloaded JSON file.

**Update your \`.env\` file with values from the JSON:**
\`\`\`env
FIREBASE_PROJECT_ID=[project_id]
FIREBASE_CLIENT_EMAIL=[client_email]
FIREBASE_PRIVATE_KEY=[private_key]
\`\`\`
*(Note: When pasting the private key into Vercel later, ensure you copy the entire string including \`-----BEGIN PRIVATE KEY-----\`)*

---

## Step 4: Get API Keys

### Resend (Emails)
1.  Go to [Resend API Keys](https://resend.com/api-keys) and create a key.
2.  Verify a domain (required for sending emails).

### OpenRouter (AI)
1.  Go to [OpenRouter Keys](https://openrouter.ai/keys) and create a key.

**Update your \`.env\` file:**
\`\`\`env
RESEND_API_KEY=[Your Resend Key]
RESEND_EMAIL_SENDER=[info@your-verified-domain.com]
OPENROUTER_API_KEY=[Your OpenRouter Key]
\`\`\`

---

## Step 5: Deploy to Vercel

### 5.1 Push to GitHub
Create a new repository on GitHub and push your code:

\`\`\`bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git add .
git commit -m "Setup for deployment"
git push -u origin main
\`\`\`

### 5.2 Deploy
1.  Go to [Vercel](https://vercel.com) and click **Add New** → **Project**.
2.  Import your new GitHub repository.
3.  **Environment Variables:** Copy the values from your local \`.env\` file and paste them into the Vercel "Environment Variables" section.
    * *Tip: You can often copy the entire text of your \`.env\` file and paste it into the first field in Vercel to auto-populate all fields.*
    * **Ensure \`NEXT_PUBLIC_SELF_HOSTED=true\` is set**.
4.  Click **Deploy**.

---

## Step 6: Final Configuration

Once deployment is complete, Vercel will assign a domain (e.g., \`feedbackland-xyz.vercel.app\`).

1.  Copy your new Vercel domain.
2.  Go back to **Firebase Console** → **Authentication** → **Settings** → **Authorized domains**.
3.  Click **Add domain** and paste your Vercel domain (without \`https://\`).

---

## 🎉 You're Live!

Visit your Vercel URL. You should be redirected to \`/get-started\` to create your first organization and admin account.
