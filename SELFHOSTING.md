# Self-hosting Feedbackland

Run your own feedback board. Your data, your domain, your costs.

You need **Docker**. Nothing else — no accounts to create, no API keys, no
config file to fill in. The database comes with it.

---

## Quick start

**1. Save this as `compose.yml`:**

```yaml
services:
  db:
    image: pgvector/pgvector:pg18
    environment:
      POSTGRES_PASSWORD: feedbackland
      POSTGRES_DB: feedbackland
    volumes:
      - db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d feedbackland"]
      interval: 5s
      timeout: 5s
      retries: 20

  app:
    image: ghcr.io/feedbackland/feedbackland:1
    environment:
      DATABASE_URL: postgres://postgres:feedbackland@db:5432/feedbackland
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

volumes:
  db:
```

Or grab it directly:

```bash
curl -O https://raw.githubusercontent.com/feedbackland/feedbackland/main/compose.yml
```

**2. Start it:**

```bash
docker compose up
```

First run pulls the images and sets up the database. When it's ready you'll see
a setup code in the terminal:

```
┌─────────────────────────────────────────────┐
│  Feedbackland is running                    │
│  http://localhost:3000                      │
│                                             │
│  Setup code:  7QK2-M4XD-9F1P                │
└─────────────────────────────────────────────┘
```

**3. Open [http://localhost:3000](http://localhost:3000)**, paste the setup
code, and fill in four fields: your product's name, your name, your email, and
a password.

That's it. Your board is live and you're signed in as its admin.

> [!NOTE]
> The setup code exists so that nobody else can claim your board if you started
> it on a server that's reachable from the internet. It stops working the
> moment you finish setup.

---

## Everyday commands

```bash
docker compose up -d      # start in the background
docker compose logs -f    # watch the logs
docker compose down       # stop (your data is kept)
docker compose pull       # fetch the latest version
```

Your data lives in the `db` Docker volume. Back it up with:

```bash
docker compose exec db pg_dump -U postgres feedbackland > backup.sql
```

That single file contains everything — posts, comments, accounts and uploaded
images. Restoring it anywhere gives you your board back, whole.

> [!WARNING]
> `docker compose down -v` deletes the volume, and with it all your data. Take
> a backup first.

---

## Next steps

Everything below is optional. Your board already works without any of it.

| | |
|---|---|
| **[Add your domain](#add-your-domain)** | Put it on `feedback.yourcompany.com` with automatic HTTPS. Needed before you can embed the widget on your site. |
| **[Turn on AI](#turn-on-ai)** | Ranked insights, ask-questions-about-your-feedback, semantic search and automatic titles. One environment variable, and it works with a local model too. |
| **[Add the widget](#add-the-widget)** | Drop a feedback button into your own app. |
| **[Sign in with Google](#sign-in-with-google)** | Optional, alongside email and password. |
| **[Password resets by email](#password-resets-by-email)** | Optional. Without it, you can still generate reset links from the admin area. |
| **[Upgrading](#upgrading)** | Pull a new image; the database updates itself. |
| **[Environment reference](#environment-reference)** | Every setting, all of them optional except the database URL. |
| **[Troubleshooting](#troubleshooting)** | Port already in use, connecting to your own Postgres, and other snags. |
