<img width="2473" height="1766" alt="Frame 586" src="https://github.com/user-attachments/assets/83008619-64d5-44ba-81ea-6b2bf65b6890" />

&nbsp;

Feedbackland is an open-source widget that collects feedback directly in your app and with AI transforms it into a prioritized product roadmap. [Visit our website](https://feedbackland.com) for more information and a live demo.

&nbsp;
&nbsp;

## Embed Feedbackland with 8 lines of code

Getting Feedbackland set up in your app is extremely straightforward. There's no need to sign up first. Just follow the steps below to get started!

Step 1: Install the package

```bash
npm i feedbackland-react
```

Step 2: Add the following component to your codebase

```tsx
import { OverlayWidget } from "feedbackland-react";

function FeedbackButton() {
  return (
    <OverlayWidget id="YOUR_UUID_v4"> {/* replace "YOUR_UUID_v4" with a randomly generated UUID v4 */}
      <button>Feedback</button> {/* use your own button */}
    </OverlayWidget>
  );
}
```

Step 3: Replace `YOUR_UUID_v4` with [a randomly generated UUID](https://www.uuidtools.com/v4)

Step 4: Replace the `<button>` element with your own button component, or style it to your liking using a framework like Tailwind.

Step 5: Use the newly added `<FeedbackButton />` component anywhere in your app (e.g. inside of a menu, sidebar, footer, ...).

Step 6: Open the widget by clicking the Feedback button. Then click **Claim Ownership** to get admin access of your platform.

Step 7: Deploy your app

Congratulations, you've successfully embedded the Feedbackland widget! It will now begin collecting user feedback. Once a sufficient amount is gathered, you can generate your first roadmap in the **Roadmap** tab of the Admin Panel.

&nbsp;
&nbsp;
&nbsp;

## About Feedbackland

Founders know the pain: you launch a feature built on instinct and hard work, and... nothing. Building in a vacuum is a risky bet. Feedbackland makes it a sure thing.
Our widget embeds in seconds to capture real user feedback: ideas, requests, and bugs. Then our AI turns it all into a clear, prioritized roadmap. So you always know exactly what to build next. No guessing involved!

&nbsp;
&nbsp;
&nbsp;

## Self-Hosting Feedbackland

Welcome to the self-hosting guide for Feedbackland! Follow these steps to get your own instance of the platform up and running.

### Prerequisites

Before you begin, make sure you have accounts for the following services:

* **Hosting & Database:**
    * [Vercel](https://vercel.com) (for hosting the application)
    * [Supabase](https://supabase.com) (for PostgreSQL database and image storage)
* **Authentication:**
    * [Firebase](https://firebase.google.com) (for user authentication)
* **Transactional Emails:**
    * [Resend](https://resend.com) (for sending emails)
* **AI Services:**
    * [Gemini API](https://aistudio.google.com/) (for generating text embeddings)
    * [OpenRouter](https://openrouter.ai) (for other AI-related tasks)
* **Code Management:**
    * [GitHub](https://github.com) (for repository management)

&nbsp;

### 1. Download the Source Code

First, you'll need to get the Feedbackland source code onto your local machine.

1.  **Download the repository:**
    You can either clone the repository or download the source code as a zip file at https://github.com/feedbackland/feedbackland/archive/refs/heads/main.zip.
    ```bash
    git clone https://github.com/feedbackland/feedbackland.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd feedbackland
    ```
3.  **Create your environment file:**
    Rename the example environment file as a starting point to create your own.
    ```bash
    mv .env.example .env
    ```
    You will populate this `.env` file with the necessary keys and credentials as you set up the required services.

&nbsp;

### 2. Supabase Setup

Next, let's configure your Supabase project for the database and file storage.

1.  **Create a new Supabase project.**
2.  **Enable the pgvector extension:**
    * Navigate to **Database** > **Extensions**.
    * Search for `vector` and enable the extension.
3.  **Disable the Data API:**
    * Go to **Project Settings** > **Data API**.
    * Under the **Config** section, toggle off **Enable Data API**.
4.  **Create a storage bucket:**
    * Go to **Storage** from the sidebar.
    * Click on **New bucket**.
    * Name the bucket `images` and turn on **Public bucket**.
5.  **Run the database schema script:**
    * In your Supabase project, click on the **Connect** button in the top bar.
    * Copy the **Direct connection** string.
    * Replace `[YOUR-PASSWORD]` with your actual database password.
    * In your terminal go to the feedbackland root folder and run the following command, replacing `"YOUR_CONNECTION_STRING"` with your complete Supabase connection string:
        ```bash
        psql --single-transaction --variable ON_ERROR_STOP=1 --file db/schema.sql "YOUR_CONNECTION_STRING"
        ```
6.  **Add Supabase credentials to your `.env` file:**
    * `DATABASE_URL`:
        * In the **Connect** section of your Supabase project, copy the **Transaction pooler** connection string.
        * Replace `[YOUR-PASSWORD]` with your database password.
        * Paste this into the `DATABASE_URL` field in your `.env` file.
    * `NEXT_PUBLIC_SUPABASE_PROJECT_ID`:
        * Go to **Project Settings** > **General**.
        * Copy the **Project ID** and paste it into the `NEXT_PUBLIC_SUPABASE_PROJECT_ID` field in your `.env` file.
    * `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
        * Go to **Project Settings** > **API Keys**.
        * Copy the `anon` **public** key and paste it into the `NEXT_PUBLIC_SUPABASE_ANON_KEY` field in your `.env` file.

&nbsp;

### 3. Firebase Setup

Now, let's set up Firebase for user authentication.

1.  **Create a new Firebase project.**
2.  **Configure your web app:**
    * From your Firebase project, obtain your web app configuration object.
    * Open the `firebaseConfig.ts` file in the root of your Feedbackland project.
    * Paste your Firebase config into this file.
3.  **Enable authentication providers:**
    * In the Firebase console, go to the **Authentication** section.
    * Enable and configure the following sign-in methods: **Email/Password**, **Google**, and **Microsoft**.
4.  **Add Firebase service account credentials to your `.env` file:**
    * Go to **Project Settings** > **Service accounts**.
    * Click on **Generate new private key**.
    * A JSON file will be downloaded. Open this file and copy the following values into your `.env` file:
        * `project_id` → `FIREBASE_PROJECT_ID`
        * `client_email` → `FIREBASE_CLIENT_EMAIL`
        * `private_key` → `FIREBASE_PRIVATE_KEY`

&nbsp;

### 4. API Key Configuration

Next, you'll need to get API keys for Resend, Gemini API, and OpenRouter.

* **Resend:**
    * Create a Resend account and generate an API key.
    * Add this key to your `.env` file: `RESEND_API_KEY=your_resend_api_key`

* **Google AI Studio (Gemini API):**
    * Create a Google AI Studio account and generate an API key.
    * Add this key to your `.env` file: `GEMINI_API_KEY=your_gemini_api_key`

* **OpenRouter:**
    * Create an OpenRouter account and generate an API key.
    * Add this key to your `.env` file: `OPENROUTER_API_KEY=your_openrouter_api_key`

&nbsp;

### 5. GitHub and Vercel Deployment

Now let's deploy your Feedbackland instance using GitHub and Vercel.

1.  **Push your code to GitHub:**
    * Create a new repository on GitHub.
    * Push your local Feedbackland codebase to the new repository.
2.  **Deploy with Vercel:**
    * On the Vercel dashboard, create a **New Project**.
    * Import your Feedbackland repository from GitHub.
    * In the project settings, navigate to the **Environment Variables** section.
    * Copy and paste all the environment variables from your local `.env` file into Vercel.
    * Click **Deploy**.
3.  **Finalize your platform setup:**
    * Once the deployment is complete, navigate to `<your-vercel-url>/get-started` (e.g., `my-feedbackland-platform.vercel.app/get-started`).
    * Enter the name for your platform and click **Create platform**.
    * You'll get redirect to your platform. As a final step claim ownership by clicking the **Claim Ownership** button in the top banner

Congratulations! 🎉 Your self-hosted Feedbackland platform should now be live.

&nbsp;

### 6. Embed The Widget In Your App

Navigate to Admin Panel > Widget to get the code snippet to embed your Feedbackland platform in your app.

&nbsp;
&nbsp;
&nbsp;

## License
Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)

