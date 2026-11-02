# Self-hosting Feedbackland

Run your own feedback board. Your data, your domain, your costs.

> **Implementation status:** P04 provides transactional boot, one-time setup,
> email sign-in/out, comments/voting and session-scoped administration. The drawer
> uses its own signed bearer session; a first-party administrator cookie never
> grants it administrative rights. Social sign-in, password/operator recovery,
> uploads, AI and search remain unavailable. The one-click, backup and product
> instructions below describe later milestones. No stable image is published.
> Use a new disposable database and an isolated checkout without hosted credentials.

**Pick the path that sounds like you:**

|                                                                     |                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **[Deploy it online in one click](#deploy-it-online-in-one-click)** | No terminal, no Docker, nothing to install. Click a button, answer two questions, wait a few minutes. **Start here if you're not sure.** |
| **[Run it with Docker](#run-it-with-docker)**                       | You're comfortable with a terminal and want it on your own machine or server.                                                            |

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

**3. Keep the generated setup code private.**

Use the 32-byte random code from the private startup log, or supply `SETUP_CODE`
as 64 hexadecimal characters or canonical padded base64 encoding of 32 random
bytes. A memorable phrase or repeated value is refused. Never put this code in a
public URL or screenshot. It is consumed after successful setup.

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

|              | Free                                                                       | Paid                         |
| ------------ | -------------------------------------------------------------------------- | ---------------------------- |
| **Database** | **Deleted after 30 days.** Your board disappears with it.                  | ~$7/month, kept indefinitely |
| **App**      | Sleeps when idle; the first visit after that takes around a minute to load | ~$7/month, always awake      |

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

**P04 contributor verification (development only)**

Use an isolated checkout without hosted dotenv files or credentials. The
committed Compose file mounts the Postgres 18 parent data directory correctly
and owns its database volume. Use only a new disposable database at this stage.

From that checkout, with Node 24 and a Linux Docker engine:

```bash
npm ci
npm run build -w feedbackland-react
npm run typecheck
npm run build
docker build --tag feedbackland:ci .
npx playwright install --with-deps chromium firefox webkit
npm run verify -- --phase 3 --image feedbackland:ci --artifacts artifacts/self-hosting
```

Run the full browser matrix on Linux; CI uses Ubuntu 24.04. The Windows
Playwright WebKit 1.64.1 port was observed to send cookies despite
`credentials: "omit"`. This is reproduced by a plain Fetch test without
Feedbackland. The server also discards ambient cookies on explicitly embedded
requests, and the Linux cookie-isolation assertion remains mandatory.

The verification runner uses only its own temporary Compose project, database,
ports and volumes, and removes them afterward. It does not read your `.env`.
It migrates fresh databases and checks the root board, public API/CORS,
restart persistence, rollback/retry, simultaneous boots, schema/revisions,
serialized admin query invariants, TLS and source/import boundaries. Its PG15/18,
vector/halfvec, extension-schema and transaction-pooler fixtures are pinned.
The injected-secret logging check includes removing the injection on restart.
The cumulative phase-3 run also checks real setup, email flows in Chromium,
Firefox and WebKit, cookie/bearer isolation, avatar preservation, immutable
session scope, absolute admin age, final-write revalidation, invite consumption,
CSRF, failed-password throttles and rollback compensation. Social/recovery,
image, AI and search gates are not counted as passed.

The separate development smoke check also owns its database and chooses free
ports; it never stops an existing Postgres service:

```bash
node --import tsx scripts/e2e/dev-smoke.ts
```

Boot runs in Next instrumentation in both modes. Do not run a separate migration
command. For schema development, `npm run db:auth-ddl` needs its **own empty
database**, and `npm run db:codegen` needs the migrated application database;
both accept `DATABASE_URL` or the isolated checkout's `.env.local`. Their
`-- --verify` mode compares output and fails on drift. Never run the auth-DDL
command against the application database. The single pre-RC migration is edited
in place, so recreate only the disposable development database after changing it.

For manual inspection, build the same local image and select it explicitly:

```bash
docker build --tag feedbackland:dev .
FEEDBACKLAND_IMAGE=feedbackland:dev docker compose -p feedbackland-p04-demo up
```

Choose an unused project name in place of `feedbackland-p04-demo`. Ensure your
shell has no inherited `DATABASE_URL` or hosted credentials before starting.
PowerShell uses `$env:FEEDBACKLAND_IMAGE = 'feedbackland:dev'` followed by
`docker compose -p feedbackland-p04-demo up`. Open `http://localhost:3000`;
follow `/setup` and use the code from this project's private app log, then fill
in the five fields. Email sign-in works after claim. Stop that project with
`docker compose -p feedbackland-p04-demo down`. Its volume preserves posts
across restarts. Never reuse a production volume. If boot reports missing settings
on a populated database, restore rather than treating it as an unclaimed install.

For a standalone copy of the committed Compose file (macOS/Linux):

```bash
curl -fsSL -o compose.yml https://raw.githubusercontent.com/feedbackland/feedbackland/694c5437976c498c123506b9a88953ae4cf999d2/compose.yml
```

On Windows use `curl.exe`. This download alone does not supply an application
image: until a release is published, build from a checkout and set
`FEEDBACKLAND_IMAGE` as above. The default `:1` reference is reserved for the
future release and is not a release installation path.

The download is pinned to the initial P01 Compose revision and remains available
after the feature branch is deleted. A checkout always contains its matching
Compose revision. If you customize `POSTGRES_PASSWORD`, use URL-unreserved
characters (`A-Z`, `a-z`, digits, `-._~`) or also set `DATABASE_URL` with the password
percent-encoded. Keep the password in the URL and the database service consistent.

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

| Feature               | What leaves your server                           |
| --------------------- | ------------------------------------------------- |
| Moderation            | the post or comment, and its images               |
| Titles and categories | the post text                                     |
| Search                | your posts (to index them) and your search terms  |
| Insights              | every post on the board                           |
| Ask AI                | your posts, plus your question                    |
| Improve draft         | the draft, only when the author clicks the button |

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

## Authentication in this development milestone

A successful setup clears its code permanently. Changing or removing `SETUP_CODE`
after claim never reopens setup. Before claim, rotate it with another random
32-byte code and restart. Setup admits five attempts per client IP per 15 minutes
and refuses attempts if its limiter is unavailable. Keep startup logs private.

Set `APP_URL` to the board's exact public HTTPS origin for Secure cookies and
stable origin checks. Without it, the origin is inferred from forwarded request
headers and the cookie remains non-Secure; trusted ingress must overwrite those
headers. First-party sessions use HttpOnly, SameSite=Lax cookies. Drawer sessions
use a signed bearer in local storage, with memory fallback when storage is denied.
Explicitly embedded auth/tRPC requests ignore ambient cookies on the server too.
Signing out of the drawer leaves the first-party sign-in intact.

Administrative rights require a matching, unexpired first-party admin session
created within the last seven days; rolling expiry does not extend that age.
Sign out and sign in again on the standalone board when this window expires.
The same admin account in a drawer can manage only its own content.

Password sign-in allows ten failed attempts per normalized email per 15 minutes,
regardless of IP. A targeted account lockout for that interval is possible.
Per-IP limits are best effort without a trusted ingress. Set `CLIENT_IP_HEADER`
for that ingress and `TRUSTED_PROXIES` to its IPs/CIDRs when it supplies a
multi-hop forwarded chain; both limiters use the same resolver.

Provider avatars remain remote URLs, so browsers contact that provider and a
backup does not contain the image bytes. Email accounts cannot set arbitrary
avatar URLs. Social sign-in and all password/operator recovery flows arrive in
P05; retain the disposable installation's administrator credentials until then.

## Troubleshooting

**The deploy failed, or the page won't load.**
Open the service's logs in your hosting dashboard — the reason is almost always
in the last few lines. You can delete the whole project and click the deploy
button again; nothing is left behind, and a second attempt costs you nothing.

**I've lost my setup code.**
If you haven't finished setup yet, change the `SETUP_CODE` setting in your
hosting dashboard to a new random 32-byte hex/base64 code and restart. If you _have_ finished setup,
you don't need it again — sign in with the email and password you chose.

**My board disappeared after about a month.**
That's the free database being deleted — see [what it costs](#what-it-costs).
Move to a paid database before this happens; there's no recovery afterwards.

**Port 3000 is already in use** _(Docker)_.
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
