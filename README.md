
<img width="2473" height="1766" alt="Frame 586" src="https://github.com/user-attachments/assets/a8529258-4625-4965-bc38-53538c5e291d" />

&nbsp;

[Feedbackland](https://feedbackland.com)'s open-source widget collects user feedback, votes and comments directly in your app, and uses AI to transform it all into a prioritized product roadmap, so you know exactly what to build next.

&nbsp;

## Get Started

[Embed Feedbackland in 30 seconds]() or [start with a standalone platform]().

&nbsp;
&nbsp;
&nbsp;

## About Feedbackland

Founders know the struggle: you launch a feature built on instinct and hard work, and... nothing. Building in a vacuum is a risky bet. Feedbackland makes it a sure thing.
Our widget embeds in seconds to capture real user feedback: ideas, requests, and bugs. Then our AI turns it all into a clear, prioritized roadmap. So you always know exactly what to build next. No guessing involved!

&nbsp;
&nbsp;
&nbsp;

## Self-Hosting Feedbackland

Follow these steps to get your own instance of the platform up and running. It shouldn't take more than 30  min of your time!

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
    You can either clone the repository, or [download the source code as a zip file](https://github.com/feedbackland/feedbackland/archive/refs/heads/main.zip).
    ```bash
    git clone https://github.com/feedbackland/feedbackland.git feedbackland
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd feedbackland
    ```
3.  **Create your environment file:**
    Rename the example environment file
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
    * In your terminal go to the feedbackland root folder and run the following command, replacing `"YOUR_CONNECTION_STRING"` with your complete Supabase connection string (i.e. `postgresql://postgres:<YOUR SUPABASE DATABASE PASSWORD>@db.<YOUR SUPABASE PROJECT ID>.supabase.co:5432/postgres`):
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
    * From your Firebase project, obtain your web app configuration object: "Get started by adding Firebase to your app" > Web > complete the wizard > copy `firebaseConfig`.
    * Open the `firebaseConfig.ts` file in the root of your Feedbackland project.
    * Paste your Firebase config into this file.
3.  **Enable authentication providers:**
    * In the Firebase console, go to the **Authentication** section.
    * Enable and configure the following sign-in methods: **Email/Password**, **Google**, and **Microsoft**.
4.  **Add Firebase service account credentials to your `.env` file:**
    * Go to **Project Settings** > **Service accounts**.
    * Click on **Generate new private key**.
    * A JSON file will be downloaded. Open this file and copy the following values, without the opening and closing quotation (`"`) characters, into your `.env` file:
        * `project_id` → `FIREBASE_PROJECT_ID`
        * `client_email` → `FIREBASE_CLIENT_EMAIL`
        * `private_key` → `FIREBASE_PRIVATE_KEY`

&nbsp;

### 4. API Key Configuration

Next, you'll need to get API keys for Resend, Gemini API, and OpenRouter.

* **Resend:**
    * Create a Resend account.
    * Generate an API key and add it to your `.env` file: `RESEND_API_KEY=your_resend_api_key`
    * Add your email domain (e.g. mycompany.com) to Resend (Note: public domains such as gmail are not supported)
    * Add the email from your email domain you want to use for sending transactional mails (e.g. info@mycompany.com) to your `.env` file: `RESEND_EMAIL_SENDER=your_email_address`. Currently this is only used for sending out admin invite mails. If you don't plan on inviting admins, you can leave the Resend .env variables empty.

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
    * Remove any existing remote origin from your feedbackland project:
      ```bash
      git remote rm origin
      ```
    * Add the remote origin from your newly created GitHub repository:
      ```bash
      git remote add origin https://github.com/feedbackland/<YOUR-REPOSITORY-NAME>.git
      ```
    * Push your local Feedbackland codebase, including all changes, to the new repository:
      ```bash
      git add -A
      git commit -m "init"
      git push -u origin main
      ```
2.  **Deploy with Vercel:**
    * On the Vercel dashboard, create a **New Project**.
    * Import your Feedbackland repository from GitHub.
    * In the project settings, navigate to the **Environment Variables** section.
    * Copy and paste all the environment variables from your local `.env` file into Vercel.
    * Click **Deploy** and wait for it to complete.
3. **Add Vercel URL to Firebase:**
   * Once your deployment on Vercel is complete, copy its URL (e.g., my-feedbackland-platform.vercel.app).
   * In the browser go to your Firebase Console and navigate to Authentication > Settings > Authorized domains.
   * Click **Add domain** and paste your Vercel URL to authorize it.
5.  **Finalize your platform setup:**
    * Now navigate to `<YOUR-PROJECT-NAME>.vercel.app/get-started`.
    * Enter the name for your platform and click **Create platform**.
    * You'll get redirect to your platform.
    * Now claim ownership by clicking the **Claim Ownership** button in the top banner and sign up with your account (Google, Microsoft or Email)
6. **Embed your self-hosted Feedbackland platform in your app**
    * In your Feedbackland platform navigate to Admin Panel > Widget.
    * Follow the instructions described on the Widget page to embed your platform into your React app

&nbsp;

Congratulations, your Feedbackland platform is live and fully embedded in your app! 🎉 Now go ahead and:
* Deploy your app to your users.
* Collect in-app feedback automatically.
* Generate your first roadmap based on real user insights!

&nbsp;
&nbsp;
&nbsp;

## License
Feedbackland is licensed under [AGPL 3.0.](https://github.com/feedbackland/feedbackland?tab=AGPL-3.0-1-ov-file)

