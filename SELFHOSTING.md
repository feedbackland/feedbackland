# Self-hosting Feedbackland

Run your own feedback board. Your data, your domain, your costs.

> **Implementation status:** P07 includes transactional boot, one-time setup,
> email sign-in/out, comments/voting and session-scoped administration. The drawer
> uses its own signed bearer session; a first-party administrator cookie never
> grants it administrative rights. Social sign-in, password reset and operator
> recovery are available. Posts, comments and logos can include images stored in PostgreSQL.
> The OpenRouter client and accounting are available internally. User-facing AI,
> search, automated backups and one-click release packaging are later milestones.
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

**P06 contributor verification (development only)**

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
npm run verify -- --phase 6a --image feedbackland:ci --artifacts artifacts/self-hosting
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
The cumulative phase-5 run also checks real setup, email flows in Chromium,
Firefox and WebKit, cookie/bearer isolation, avatar preservation, immutable
session scope, absolute admin age, final-write revalidation, invite consumption,
CSRF, failed-password throttles and rollback compensation. HTTPS mock OIDC,
COOP and Helmet fixtures exercise real popup callbacks and polling in all three
engines; Mailpit checks actual reset delivery. Two replicas exercise discovery
retry/cancellation, and PostgreSQL faults exercise interrupted recovery. Phase 5 also exercises attachment uploads, quotas across two replicas,
image lifetimes and recovery into two fresh databases. Real Google/Microsoft and Safari
device checks remain release work.

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

## Images and storage

Anyone who can post on a configured board can upload an image. Attach a file,
paste an image, or drop it into the editor. The editor accepts source files up
to 25 MB, resizes photos to a longest edge of 2,000 pixels, and shows an upload
indicator until the attachment is ready. GIFs retain their animation. Browser
re-encoding generally removes photo metadata. Direct uploads and untouched GIFs
can retain EXIF, including location. Remove sensitive metadata before sharing.

The server accepts static PNG, JPEG and WebP, and GIFs with at most 100 frames,
60 seconds of declared animation and 40 million canvas pixels across frames.
Every image must fit within 10,000 pixels per side and 40 million pixels. These
are container checks. The server stores and serves the accepted bytes.

| Environment variable | Bytes | What it limits |
| --- | ---: | --- |
| `MAX_IMAGE_BYTES` | 4,000,000 by default | Encoded file. Set between 1 and 4,000,000. |
| `MAX_PENDING_IMAGE_BYTES` | 200,000,000 by default | Combined bytes in unattached uploads. Zero prevents new uploads. |
| `MAX_IMAGE_STORAGE_BYTES` | Unlimited by default | Combined stored attachment bytes. Allow additional database space for other data, indexes and backups. |

Apply the same limits to every replica. Admin → System shows current total and
unattached bytes. Reclaiming requires a preview and confirmation in a fresh
first-party administrator session. Unsubmitted drafts can lose reclaimed
attachments. Hourly cleanup removes unattached uploads older than 24 hours.
Removing an image during an edit can delete it immediately if the pending limit
is full. Deleting a post or comment removes attachments that lose their last
reference. Shared images and the current logo survive. An already cached public
image can remain visible for up to one day.

## Backups and private restore

The database contains accounts, posts, comments, logo and attachment bytes.
Keep the archive private. Store a separate protected copy of your configuration,
including any injected `BETTER_AUTH_SECRET`, provider credentials and mail
settings. Keep both copies outside the database volume.

Use the backup helper from this checkout in a POSIX shell. Give it the exact title shown on the board and an existing private destination on the host. It makes a new directory per run, checks the source board, reads back the full custom-format archive and records its SHA-256. A failed run leaves earlier backups available.

For the bundled database, use the same Compose project, directory and Compose files that started the board. The helper reads the running app's database coordinates and selects that project's database service. Substitute your own project and title below.

```sh
project=feedbackland-p04-demo
archive=$(sh scripts/backup-board.sh compose "$project" 'My feedback board' "$HOME/private-backups") || exit 1
cat "$archive/source.json"
```

For an external database or a custom connection, configure a private libpq service in `pg_service.conf` with the host, port, database, role and TLS settings from the app's effective `DATABASE_URL`. Supply the password through a protected passfile. Use compatible PostgreSQL client tools on the host. Verify the endpoint and database independently against the running deployment, especially when cloned boards share a title.

```sh
archive=$(sh scripts/backup-board.sh service feedbackland-source 'My feedback board' "$HOME/private-backups") || exit 1
cat "$archive/source.json"
```

Check the database, board title, setup timestamp and vector schema in that inventory before accepting the archive. The backup contains PostgreSQL's consistent snapshot at dump time. For a **planned cutover**, put the source in maintenance, drain requests and stop every writer, including app replicas, background jobs and other database clients. Take the final dump through the verified libpq service while the apps are stopped. Keep writers stopped until the destination is verified and traffic has switched. Record source table counts, image IDs and SHA-256 hashes, image references and the logo during that same quiet interval. Keep the source database for rollback.

For **incident recovery**, record which archive and recovery time you selected. Changes after that snapshot require separate recovery. Use a fresh target and the inventory from that recovery point. Verify the archive checksum after copying it and before restoring.

```sh
(cd "$archive" && sha256sum -c sha256.txt) || exit 1
```

On macOS use `shasum -a 256 -c sha256.txt`. Restore into a new private database on the intended cluster, using compatible PostgreSQL and pgvector versions and a restore client at least as new as the dump client. For the bundled service on the selected project, this example assumes the source vector schema is `public` and the target database name is unused.

```sh
(
  set -eu
  docker compose -p "$project" exec -T db createdb -U postgres feedbackland_restore
  docker compose -p "$project" exec -T db pg_restore -U postgres -d feedbackland_restore --no-owner --no-privileges --no-comments --single-transaction --exit-on-error < "$archive/feedbackland.dump"
)
```

For an external target, create a new empty database and a separate protected libpq service pointing to it. Verify its endpoint and database, then run `pg_restore --dbname='service=feedbackland-restore' --no-owner --no-privileges --no-comments --single-transaction --exit-on-error < "$archive/feedbackland.dump"`.

If the target already provides pgvector in a different schema, have the extension owner move it to the recorded source schema before running the restore. If you created that schema on the target, use the archive inventory with `pg_restore --use-list` and omit only that schema's already-created entry. Stop if relocation is unavailable. Compare counts, hashes, references and the logo before starting the app or housekeeping. Set the restored app's `DATABASE_URL` to the new database, restore the original secrets and start it privately. Verify an existing account can sign in and that its attachments render before switching traffic.

---

## AI configuration in this development milestone

P07 adds the server-side OpenRouter client, configuration store and usage accounting. Public posting, editing and the widget continue to work without a key. Moderation, generated titles, semantic search, insights, Ask AI and the admin controls are scheduled in later milestones.

| Environment setting | Default | Effect |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Unset | Credential for requests to OpenRouter. Keep it in your server environment. |
| `OPENROUTER_MODEL` | `google/gemini-3.8-flash` | Chat model ID. |
| `OPENROUTER_EMBEDDING_MODEL` | `openai/text-embedding-3-small` | The small and large OpenAI text-embedding-3 models have tokenizer profiles. `none` disables embedding calls. |
| `OPENROUTER_PRIVACY` | `deny` | `deny` requests providers that decline data collection. `zdr` also requires zero data retention. `allow` permits collection. |
| `AI_TIMEOUT_MS` | `15000` | Request timeout in milliseconds, from 1,000 through 120,000. |
| `AI_DAILY_CALL_LIMIT` | `5000` | Ordinary model requests per UTC day, from 10 through 1,000,000. Moderation can use the full limit. Other calls share the first 80%. |
| `AI_EMBEDDING_DIMENSIONS` | `768` | Physical vector width selected at database creation. |

Use identical AI settings on every replica. To change environment overrides, stop all replicas, allow the previous configuration leases to expire (20 seconds), then restart with the new values. A replica that detects a configuration mismatch suspends AI requests. Environment settings override their stored fields. An explicit administrative off setting takes precedence over an environment key.

Embedding inputs preserve a Unicode prefix of up to 8,000 tokens. An uninterrupted tokenizer segment longer than 1,024 bytes truncates the input at that segment, which bounds processing time for long identifiers or encoded text.

Each attempted model request, including an allowed retry, consumes an allowance. An explicit administrator **Test again** may use up to 40 additional requests per UTC day across the instance. Usage records distinguish a reported zero price from a missing price. OpenRouter key spend limits control the monetary amount.

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
regardless of IP. An in-flight attempt reserves one of those ten slots before
password verification; successful and non-authentication-error attempts refund
their slots. Interrupted attempts conservatively occupy a slot until that window
expires. A targeted account lockout for that interval is possible.
Per-IP limits are best effort without a trusted ingress. Set `CLIENT_IP_HEADER`
for that ingress and `TRUSTED_PROXIES` to its IPs/CIDRs when it supplies a
multi-hop forwarded chain; both limiters use the same resolver.

Provider avatars remain remote URLs, so browsers contact that provider and a
backup does not contain the image bytes. Email accounts cannot set arbitrary
avatar URLs. Provider sign-in refreshes name/avatar; name-only edits preserve
the provider avatar. Provider access, refresh and ID tokens are not persisted.

### Social sign-in

Set a fixed HTTPS `APP_URL`, then configure a provider's credentials from
`.env.example`. Register the exact callback shown in **Admin > System**:
`APP_URL/api/auth/callback/google`, `/microsoft` or `/oidc`. A provider button
appears only when configured and available. OIDC requires an HTTPS issuer and
HTTPS endpoints in its discovery document. Generic OIDC discovery validates
issuer/JWKS metadata within ten seconds; failed discovery retries automatically
after a minute. **Retry discovery** on System advances a shared epoch so other
replicas converge within five seconds plus the bounded construction time. A
failed retry preserves the last working provider. Board pages, settings, Google,
Microsoft and password sign-in stay available during discovery.
The token endpoint uses `client_secret_basic` when discovery omits the method
or offers both Basic and POST. For a client registered for a particular method,
set `OIDC_TOKEN_ENDPOINT_AUTH_METHOD` to `client_secret_basic` or
`client_secret_post`. The issuer must advertise support for the selected method.

Each sign-in opens a confirmation page outside the widget. Allow that popup,
confirm the board and choose your account. Keep the widget open until it reports
success; polling also works when the provider severs the opener. Sign-out stays
on the board and does not sign you out of your identity provider. Account linking
is disabled: use the original method when an email is already registered.

### Password reset

For email delivery, set `APP_URL`, `SMTP_URL` (`smtp://` or `smtps://`) and
`SMTP_FROM`, then restart every replica. The System page reports whether mail is
enabled. Without mail, the reset dialog asks the user to contact an administrator.
An administrator can generate a one-time reset link for an existing non-admin
password account under **Admin > Admins**. This also works with an inferred app
origin. Give the link privately to that account owner. Administrators and
social-only accounts cannot receive an administrator-generated reset link.
At redemption, the issuer must still be an administrator and the recipient must
still be a non-admin password account. A successful reset revokes every session
and all outstanding reset links for the account. Changing the password while
signed in also invalidates outstanding reset links.

When upgrading an existing installation to this version, stop the previous
replicas before serving authentication traffic on the new version. The migration
expires previously issued reset links because those records did not identify
their issuer. Request new links after the upgrade.

### Recover administrator access

Temporarily configure `RECOVERY_CODE` as 32 random bytes in hex or canonical
padded base64, then restart all replicas. Keep it private. Visit `/recover`, enter
the code, an existing administrator's password-account email and a new password,
then review and confirm the displayed email. Recovery allows five attempts per
client IP per fifteen minutes and refuses attempts when its limiter is unavailable.

If no administrators remain, recovery can promote an existing password account.
It cannot create an account or convert a social-only identity. If necessary,
register a password account first. Recovery revokes the target account's sessions.
An interrupted attempt may already have changed the password; no administrator
access is reported until the final transaction commits. A live claim reserves
that account for fifteen minutes. Retry with the same code after the claim
expires. If its reset committed and the credential still matches, use the
password from that attempt. If another password change intervened, the retry
sets the newly submitted password before granting administrator access.
Successful recovery revokes outstanding reset links as well as sessions.

**After success, remove `RECOVERY_CODE` from every replica and restart them.**
The recovery route then returns HTTP 404. To perform a new recovery after an
already recovered account was subsequently demoted or changed its password,
rotate to a new random code.
Do not reuse setup codes, put recovery codes in URLs or retain reset links in logs.

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
The [AI configuration](#ai-configuration-in-this-development-milestone) section lists the server settings for P07.

- **Add the widget** — drop a feedback button into your own app.
- **Use your own domain** — `feedback.yourcompany.com`, with HTTPS.
- **Sign in with Google**, alongside email and password.
- **Password resets by email** — optional; without it you can still generate
  reset links from the admin area.
- **Upgrading** — the database updates itself; you just take the new version.
- **Settings reference** — everything configurable. All optional except the
  database.
