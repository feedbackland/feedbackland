# Self-hosting Feedbackland

Run your own feedback board. Your data, your domain, your costs.

**Pick the path that sounds like you:**

| | |
|---|---|
| **[Deploy it online in one click](#deploy-it-online-in-one-click)** | No terminal, no Docker, nothing to install. Click a button, answer two questions, wait a few minutes. **Start here if you're not sure.** |
| **[Run it with Docker](#run-it-with-docker)** | You're comfortable with a terminal and want it on your own machine or server. |

---

## Deploy it online in one click

This gives you a real, public feedback board on an `https://` address, with a
database, backups and automatic updates. You don't install anything.

### What you'll need

- A **GitHub account** (free — the deploy platform signs you in with it)
- About **five minutes**

That's the whole list. No API keys, no configuration files, no Docker.

### Steps

**1. Click a deploy button.**

| Where | Button | What it costs |
|---|---|---|
| Render | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/feedbackland/feedbackland) | Free to try. The free database is deleted after 30 days and the free app sleeps when nobody's using it, so pick a paid database (~$7/mo) if you want to keep it. |
| Railway | [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/feedbackland/feedbackland) | No free tier. Around $5/month for the app and database together. |

**2. Sign in** with GitHub and let it create the project.

**3. When it asks for a Setup code, type anything you'll remember.**

This is the one thing you'll be asked for. It's a one-time password that stops
a stranger claiming your board before you do. Write it down — you'll need it in
about three minutes, and never again.

**4. Wait for it to finish**, then open the address it gives you. It looks like
`https://feedbackland-something.onrender.com`.

**5. Fill in the form**: your setup code, your product's name, your name, your
email, and a password.

Your board is live. You're signed in as its admin, and because the address is
already `https://`, you can put the feedback widget on your own site straight
away.

> [!TIP]
> You can point your own domain (like `feedback.yourcompany.com`) at it later
> from the platform's dashboard. Nothing in Feedbackland needs to change.

---

## Run it with Docker

For this one you'll need **Docker** (Docker Desktop, or Docker Engine with the
Compose plugin) and a terminal.

**1. Save this as `compose.yml`:**

```yaml
services:
  db:
    image: pgvector/pgvector:pg18
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: feedbackland
      POSTGRES_DB: feedbackland
    volumes:
      - db:/var/lib/postgresql/data
    healthcheck:
      # -h forces a TCP check. Without it this passes during the database's
      # own first-time setup, while it is still socket-only, and the app
      # starts against a server that is about to restart.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d feedbackland"]
      interval: 5s
      timeout: 5s
      retries: 20

  app:
    image: ghcr.io/feedbackland/feedbackland:1
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://postgres:feedbackland@db:5432/feedbackland
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s

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

When it's ready you'll see a setup code in the terminal:

```
┌─────────────────────────────────────────────┐
│  Feedbackland is running                    │
│  http://localhost:3000                      │
│                                             │
│  Setup code:  7QK2-M4XD-9F1P                │
└─────────────────────────────────────────────┘
```

**3. Open [http://localhost:3000](http://localhost:3000)**, paste the setup
code, and fill in your product's name, your name, your email and a password.

> [!NOTE]
> A board on `http://localhost` works fine for you, but the feedback **widget**
> can't be embedded on a real website from it — browsers block insecure frames.
> For that you need a domain with HTTPS, which is what the
> [one-click deploy](#deploy-it-online-in-one-click) gives you for free.

### Everyday commands

```bash
docker compose up -d      # start in the background
docker compose logs -f    # watch the logs
docker compose down       # stop (your data is kept)
docker compose pull       # fetch the latest version
```

---

## Backups

Your data lives in the `db` Docker volume.

**Back up:**

```bash
docker compose exec -T db pg_dump -U postgres feedbackland > backup.sql
```

**Restore** (into an empty database):

```bash
docker compose exec -T db psql -U postgres -d feedbackland < backup.sql
```

That single file contains everything — posts, comments, accounts and uploaded
images. Restoring it anywhere gives you your board back, whole, which is also
how you move between any of the options on this page.

> [!IMPORTANT]
> The `-T` matters. Without it Docker attaches a terminal to the command, which
> rewrites line endings on the way out and leaves you with a backup that looks
> fine and will not restore.

> [!WARNING]
> `docker compose down -v` deletes the volume, and with it all your data. Take
> a backup first.

If you deployed online, the platform takes care of database backups for you —
but it's worth keeping your own copy too.

---

## Next steps

Everything below is optional. Your board already works without any of it.

| | |
|---|---|
| **[Turn on AI](#turn-on-ai)** | Ranked insights, ask-questions-about-your-feedback, semantic search and automatic titles. One setting, and it works with a local model too. |
| **[Add the widget](#add-the-widget)** | Drop a feedback button into your own app. |
| **[Use your own domain](#use-your-own-domain)** | `feedback.yourcompany.com`, with HTTPS. |
| **[Sign in with Google](#sign-in-with-google)** | Optional, alongside email and password. |
| **[Password resets by email](#password-resets-by-email)** | Optional. Without it, you can still generate reset links from the admin area. |
| **[Upgrading](#upgrading)** | The database updates itself; you just take the new version. |
| **[Settings reference](#settings-reference)** | Everything you can configure. All of it optional except the database. |
| **[Troubleshooting](#troubleshooting)** | Port already in use, using your own database, and other snags. |
