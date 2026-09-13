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
database and backups. You don't install anything.

### What you'll need

- A **GitHub account** (free — the deploy platform signs you in with it)
- About **five minutes**
- Roughly **$7/month**. See [what it costs](#what-it-costs) before you start —
  there is a free option, but it deletes your database after 30 days.

That's the whole list. No API keys, no configuration files, no Docker.

### Steps

**1. Click the button:**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/feedbackland/feedbackland)

**2. Sign in** with GitHub and let it create the project. You don't need to
fork or copy anything — it reads this repository directly.

**3. When it asks for a Setup code, type anything you'll remember.**

This is the one thing you'll be asked for. It's a one-time password that stops
a stranger claiming your board before you do. Write it down — you'll need it in
about three minutes, and never again.

**4. Wait for it to finish**, then open the address it gives you. It looks like
`https://feedbackland-something.onrender.com`.

**5. Fill in the form**: your setup code, your product's name, your name, your
email, and a password.

> [!TIP]
> If the deploy fails or the page won't load, the platform's own logs say why —
> and [Troubleshooting](#troubleshooting) covers the usual causes. You can
> delete the project and click the button again as many times as you like;
> nothing is left behind.

Your board is live. You're signed in as its admin, and because the address is
already `https://`, you can put the feedback widget on your own site straight
away.

> [!TIP]
> You can point your own domain (like `feedback.yourcompany.com`) at it later
> from the platform's dashboard. Nothing in Feedbackland needs to change.

### What it costs

Render will offer you free options during setup. They're genuinely useful for
having a look, and genuinely unsuitable for keeping:

| | Free | Paid |
|---|---|---|
| **Database** | **Deleted after 30 days.** Your board disappears with it. | ~$7/month, kept indefinitely |
| **App** | Sleeps when idle; the first visit after that takes around a minute to load | ~$7/month, always awake |

If this is a real feedback board, choose the paid database. The sleeping app is
more tolerable — but it's worth knowing that a sleeping board also means the
feedback widget on your site takes that minute to open the first time.

> [!NOTE]
> Feedbackland doesn't charge anything and never sees your data. This is what
> the hosting provider charges to run it for you.

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

Or download it, on macOS and Linux:

```bash
curl -fsSL -o compose.yml https://raw.githubusercontent.com/feedbackland/feedbackland/main/compose.yml
```

> [!NOTE]
> On Windows, use `curl.exe` rather than `curl` — in PowerShell, plain `curl`
> is a different command and will reject these options. Copying the file above
> works everywhere.

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

## Turn on AI

Feedbackland works completely without this. Posting, commenting, voting,
searching, the widget — all of it runs with nothing configured, and it always
will.

But AI is where this stops being a list of feedback and starts telling you
things. With a model configured you get:

- **Insights** — your whole board condensed into a ranked list of what people
  actually need, scored by how many asked and how badly.
- **Ask AI** — "what are people saying about pricing?", answered from your
  feedback.
- **Better search** — finds "can't log in" when someone wrote "authentication
  broken".
- **Automatic titles and categories** on every post.

It is genuinely optional and honestly recommended — it's the difference between
a feedback board and knowing what to build next.

### First, the part that matters

You're about to be asked to paste a key and to send your users' feedback
somewhere. Here's exactly where you stand:

- **The key stays on your server.** It's only ever used in server-side code,
  never sent to a browser, and never written to logs.
- **We never see any of it.** There is no Feedbackland server involved in your
  installation. Requests go from your machine directly to whichever provider
  you pick. We couldn't see your key or your feedback if we wanted to.
- **Nothing phones home.** Feedbackland contains no analytics, no telemetry, no
  error reporting. You can search the source for it.
- **It's your account.** Your key, your spending limit, your usage dashboard.
  Revoke it whenever you like.
- **Turning it off costs you nothing.** Remove the setting and the AI features
  disappear. Every post, comment and vote stays exactly where it was.

**What actually gets sent, if you turn it on:**

| Feature | What leaves your server |
|---|---|
| Moderation | the post or comment, and its images |
| Titles and categories | the post text |
| Search | your posts (to index them) and your search terms |
| Insights | every post on the board |
| Ask AI | your posts, plus your question |
| Improve draft | the draft, only when the author clicks the button |

With nothing configured, none of these requests happen at all.

### Pick how you want to run it

**Option 1 — a model on your own machine. Free, and nothing leaves it.**

Install [Ollama](https://ollama.com), pull a model, and point Feedbackland at
it:

```
LLM_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL=llama3.1
```

No account, no key, no data leaving your network. It's open source, it's free,
and it's the right answer if your feedback is sensitive. The trade-off is
honest: you need a reasonably capable machine, and a small local model won't
match a large hosted one.

**Option 2 — a hosted key. Cents a month, best results.**

Create a key at [OpenRouter](https://openrouter.ai) — or any OpenAI-compatible
provider — and set:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

Set a spending limit on the provider's side while you're there. For a board
getting a few posts a day this costs small change.

**Option 3 — free hosted models. Read this bit first.**

Some providers offer models at no cost, and they're a reasonable way to try
this out. Two things to know before you rely on them:

- They're **heavily rate-limited** — OpenRouter allows roughly 50 requests a
  day until you've bought $10 of credit, and a single post uses three.
- On some free endpoints, **your prompts are the payment**: the text you send
  may be used to train models. For feedback your users wrote in confidence,
  that may not be a trade you want to make.

If privacy matters more than convenience, Option 1 is free too — and nothing
leaves your server.

> [!TIP]
> Already have posts from before you turned AI on? They won't appear in
> semantic search until they're indexed. Run
> `docker compose exec app node scripts/backfill-embeddings.mjs` once, and
> they will.

---

## Troubleshooting

**The deploy failed, or the page won't load.**
Open the service's logs in your hosting dashboard — the reason is almost always
in the last few lines. You can delete the whole project and click the deploy
button again; nothing is left behind, and a second attempt costs you nothing.

**I've lost my setup code.**
If you haven't finished setup yet, change the `SETUP_CODE` setting in your
hosting dashboard to something new and restart. If you *have* finished setup,
you don't need it again — sign in with the email and password you chose.

**My board disappeared after about a month.**
That's the free database being deleted — see [what it costs](#what-it-costs).
Move to a paid database before this happens; there's no recovery afterwards.

**Port 3000 is already in use** *(Docker)*.
Something else on your machine is using it. Change the first number in
`compose.yml`, for example `"3001:3000"`, then open
[http://localhost:3001](http://localhost:3001) instead.

**The widget won't open on my website.**
Browsers refuse to embed an insecure page inside a secure one, so a board on
`http://localhost` can't be embedded on an `https://` site. Deploy it online —
that address is `https://` from the start.

**I want to use my own database.**
Remove the `db` service from `compose.yml` and point `DATABASE_URL` at your
own Postgres. Two things it needs:

- **The `pgvector` extension.** Available on RDS, Cloud SQL, Neon, Supabase and
  most managed Postgres. Without it the first startup stops and tells you so.
- **`?sslmode=require` on the end of the URL** if your provider requires an
  encrypted connection — most managed ones do.

---

## Next steps

Everything here is optional — your board already works without any of it —
and each is covered in the sections that follow this guide as they land.
[Turning on AI](#turn-on-ai) is written up above.

- **Add the widget** — drop a feedback button into your own app.
- **Use your own domain** — `feedback.yourcompany.com`, with HTTPS.
- **Sign in with Google**, alongside email and password.
- **Password resets by email** — optional; without it you can still generate
  reset links from the admin area.
- **Upgrading** — the database updates itself; you just take the new version.
- **Settings reference** — everything configurable. All optional except the
  database.
