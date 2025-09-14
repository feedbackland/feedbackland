# Self-Host Feedbackland for free in 30 minutes

Follow these steps to get your own self-hosted instance of Feedbackland up and running for free in 30 minutes. In case you bump into an issue, do not hesitate to [contact us](mailto:hello@feedbckland.com) for help.

### Prerequisites

Before you begin, make sure you have accounts for the following services, which can all be used for free:

- **Hosting & Database:**
  - [Vercel](https://vercel.com) (for hosting the application)
  - [Supabase](https://supabase.com) (for PostgreSQL database and image storage)
- **Authentication:**
  - [Firebase](https://firebase.google.com) (for user authentication)
- **Transactional Emails:**
  - [Resend](https://resend.com) (for sending transactional emails)
- **AI Services:**
  - [Gemini API](https://aistudio.google.com/) (for generating text embeddings)
  - [OpenRouter](https://openrouter.ai) (for all other AI-related tasks)
- **Code Management:**
  - [GitHub](https://github.com) (for repository management)

&nbsp;

## 1. Download the Source Code

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
    In the following steps you will populate this `.env` file with the necessary keys and credentials.

&nbsp;

## 2. Supabase Setup

Next, let's configure your Supabase project for the database and file storage.

1.  **Create a new Supabase project.**
2.  **Enable the pgvector extension:**
    - Navigate to **Database** > **Extensions**.
    - Search for `vector` and enable the extension.
3.  **Disable the Data API:**
    - Go to **Project Settings** > **Data API**.
    - Under the **Config** section, toggle OFF **Enable Data API**.
4.  **Create a storage bucket:**
    - Go to **Storage** from the sidebar.
    - Click on **New bucket**.
    - Name the bucket `images` and turn on **Public bucket**.
5.  **Run the database schema script:**
    - In your Supabase project, click on the **Connect** button in the top bar.
    - Copy the **Direct connection** string.
    - Replace `[YOUR-PASSWORD]` with your actual database password.
    - In your terminal run the following command, replacing `"YOUR_CONNECTION_STRING"` with your complete Supabase connection string:
      ```bash
      psql --single-transaction --variable ON_ERROR_STOP=1 --file db/schema.sql "YOUR_CONNECTION_STRING"
      ```
6.  **Add Supabase credentials to your `.env` file:**
    - `DATABASE_URL`:
      - In your Supabase project, click on the **Connect** button in the top bar.
      - Copy the **Transaction pooler** connection string.
      - Replace `[YOUR-PASSWORD]` with your database password.
      - Copy-paste this string into the `DATABASE_URL` field in your `.env` file.
    - `NEXT_PUBLIC_SUPABASE_PROJECT_ID`:
      - Go to **Project Settings** > **General**.
      - Copy the **Project ID** and paste it into the `NEXT_PUBLIC_SUPABASE_PROJECT_ID` field in your `.env` file.
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
      - Go to **Project Settings** > **API Keys**.
      - Copy the `anon` **public** key and paste it into the `NEXT_PUBLIC_SUPABASE_ANON_KEY` field in your `.env` file.

&nbsp;

## 3. Firebase Setup

Now, let's set up Firebase, which is used for user authentication.

1.  **Create a new Firebase project.**
2.  **Configure your web app:**
    - In the Firebase console, create and copy your web app configuration object.
    - Open the `firebaseConfig.ts` file in the root of your Feedbackland project.
    - Paste your Firebase config into this file, overwriting the existing object.
3.  **Enable authentication providers:**
    - In the Firebase console, go to the **Authentication** section.
    - Enable and configure the following sign-in methods: **Email/Password**, **Google**, and **Microsoft**.
4.  **Add Firebase service account credentials to your `.env` file:**
    - In the Firebase Console, go to **Project Settings** > **Service accounts**.
    - Click on **Generate new private key**.
    - A JSON file will be downloaded. Open this file and copy the following values, without the opening and closing quotation (`"`) characters, into your `.env` file:
      - `project_id` → `FIREBASE_PROJECT_ID`
      - `client_email` → `FIREBASE_CLIENT_EMAIL`
      - `private_key` → `FIREBASE_PRIVATE_KEY`

&nbsp;

## 4. API Key Configuration

Next, you'll need to get API keys for Resend, Gemini API, and OpenRouter.

- **Resend:**
  - Create a Resend account.
  - Generate an API key and add it to your `.env` file: `RESEND_API_KEY=your_resend_api_key`
  - Add your email domain (e.g. `mycompany.com`) to Resend
  - Add the full email address you want to use for sending transactional emails (e.g. `info@mycompany.com`) to your `.env` file: `RESEND_EMAIL_SENDER=your_email_address`. Note: the email address must belong to the domain you added on Resend.

- **Google AI Studio (Gemini API):**
  - Create a Google AI Studio account and generate an API key.
  - Add this key to your `.env` file: `GEMINI_API_KEY=your_gemini_api_key`

- **OpenRouter:**
  - Create an OpenRouter account and generate an API key.
  - Add this key to your `.env` file: `OPENROUTER_API_KEY=your_openrouter_api_key`

&nbsp;

## 5. GitHub and Vercel Deployment

Now let's deploy your Feedbackland instance using GitHub and Vercel.

1.  **Push your code to GitHub:**
    - Create a new repository on GitHub.
    - Remove any existing remote origin from your local Feedbackland codebase:
      ```bash
      git remote rm origin
      ```
    - Add the remote origin from your newly created GitHub repository:
      ```bash
      git remote add origin https://github.com/<YOUR-GITHUB-ACCOUNT-NAME>/<YOUR-REPOSITORY-NAME>.git
      ```
    - Push your local Feedbackland codebase, including all changes, to the new repository:
      ```bash
      git add -A
      git commit -m "init"
      git push -u origin main
      ```
2.  **Deploy with Vercel:**
    - On the Vercel dashboard, create a **New Project**.
    - Import your Feedbackland repository from GitHub.
    - In the project settings, navigate to the **Environment Variables** section.
    - Copy and paste all the environment variables from your local `.env` file into Vercel.
    - Click **Deploy** and wait for it to complete.
3.  **Add Vercel URL to Firebase:**
    - Once your deployment on Vercel is complete, copy its URL (e.g., my-feedbackland-platform.vercel.app).
    - In the browser go to your Firebase Console and navigate to Authentication > Settings > Authorized domains.
    - Click **Add domain** and paste your Vercel URL to authorize it.
4.  **Finalize your platform setup:**
    - Now navigate to `<YOUR-PROJECT-NAME>.vercel.app/get-started`.
    - Enter the name for your platform and click **Create platform**.
    - You'll get redirect to your platform.
    - Now claim ownership by clicking the **Claim Ownership** button in the top banner, and sign up.
5.  **Embed your self-hosted Feedbackland platform in your app**
    - In your Feedbackland platform navigate to Admin Panel > Widget.
    - Follow the instructions described on the Widget page to embed your platform into your React or Next.js app

&nbsp;

Congratulations, your Feedbackland platform is now embedded in your app and accessible at the click of a button! 🎉

Now go ahead and:

- Deploy your app.
- Start collecting in-app feedback.
- Generate your first AI Roadmap!

&nbsp;
&nbsp;
&nbsp;
