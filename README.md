<p align="center">
  <a href="https://run-nook.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.webp">
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.webp">
      <img src=".github/assets/banner-light.webp" width="100%" alt="Nook: Talk it through. Get it done. 100% free, open source alternative to Slack and Microsoft Teams.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://run-nook.com">run-nook.com</a> · <a href="https://justevery.com">Part of Just Every</a> · <a href="LICENSE">MIT licensed</a></p>

<p align="center">
  <a href="https://justevery.com/#vol-nook"><img src=".github/assets/media/preview.gif" width="800" alt="Nook: Priya asks Sam to book the room inside the thread, and Sam accepts the request from his Attention page"></a>
</p>
<p align="center"><a href="https://justevery.com/#vol-nook"><b>Watch the full demo</b></a> · 49 seconds</p>

<p align="center">
  <img src=".github/assets/media/flow.webp" width="800" alt="A request moving from Awaiting agreement to Accepted, then a decision recorded in the channel">
</p>

<p align="center">
  <img src=".github/assets/media/screen-1.webp" width="800" alt="The #launch channel in Nook: a request for Sam Rivera marked Accepted under Priya's question, and Marco's message recorded as a decision with reactions"><br>
  <sub>Requests and decisions live in the thread, where everyone can see them.</sub>
</p>

<p align="center">
  <img src=".github/assets/media/screen-2.webp" width="800" alt="Sam's Attention page during quiet time: three saved for later, and Priya's urgent request coming through"><br>
  <sub>Quiet time saves the rest for later; an urgent request still reaches you.</sub>
</p>

# Nook

The current release is **0.5.0**. See the [release notes](CHANGELOG.md#050--2026-10-24)
and [updating guide](docs/updating.md) before upgrading an existing Nook.

Nook is a team workspace with private channels, fixed-participant DMs, threads,
versioned decisions, commitments that only their assignee can accept, private
files and calm attention. It runs as one Cloudflare Worker: React/TanStack Start
documents, a Hono HTTP boundary, D1 storage and Base operator-auth sign-in.

## Run it on your computer

One line installs the `rer` command, clones the latest source from `main` into
`run-nook` and starts it. Git is required; rer brings Node and pnpm.

Use `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-nook`.

Already have Node 22 or later? This does the same:

```sh
npx -y @runeditrun/rer dev just-every/run-nook
```

To start it again later, run the same line from the same folder,
or `cd run-nook && rer dev`.

To run the **0.5.0 release** instead, clone it in place of the line above,
then run `rer dev` from the cloned folder:

```sh
git clone --branch v0.5.0 https://github.com/just-every/run-nook.git run-nook && cd run-nook
```

The release tag checks out a fixed version. The `git pull --ff-only` update
instructions below apply to a checkout of `main`; see the
[updating guide](docs/updating.md) for moving a release checkout forward.

`rer` manages this checkout's pinned Node and pnpm versions.
You do not need a separate pnpm installation.
`rer dev` prepares the local settings and database and creates a placeholder
owner, **Owner (owner@run-nook.test)**. Open the link it prints, then confirm that
account on **Finish setup** to enter the workspace. This is a local account for
trying Nook. To use your own email instead, stop the app with `rer dev --stop`, run
`rer setup --owner-email you@example.com`, then start it again with `rer dev`.

This keeps the same owner ID and your local data. You can also run setup before
the first dev launch to choose the local owner from the start.

`dev` starts the app with live reload and prints `RER_READY http://127.0.0.1:P`,
`RER_SIGNED_IN` with the development owner email and an `RER_OPEN` link. Open that link on this
computer and Nook opens signed in as the local owner through a local-only dev session. The
link carries this checkout's dev key in its fragment, so treat it like a
password and keep it on this computer. Your first visit lands on `/setup`:
confirm the owner account there once and Nook opens the workspace. Until you do,
every app page sends you back to `/setup`.

After the owner finishes setup, create a channel. To try a teammate, open
`/auth/dev/enter?as=member` in that same browser. This creates the independent
local account `member@dev.localhost`. Return through
`/auth/dev/enter?as=owner`, add the member from the channel's **Details** control,
then open `/auth/dev/enter?as=member` again to use that channel as the member.
The `admin` and `guest` personas are also available at the same entry route.
A fresh browser must open `RER_OPEN` before any local persona route works.
These local personas do not accept invitations to arbitrary email addresses.
Local development sends and stores no email and has no mail viewer; no mail
provider account is needed. `rer dev --login` uses the same automatic owner
entry as `rer dev`.

```sh
rer dev --stop
rer verify             # the complete test suite
```

On a hosted installation, only people the owner invites can join; a sign-in
request for an unknown mailbox creates nothing. Prefer a
browser wizard? `node scripts/install.mjs` opens the same setup as a guided
installer.

`rer preview` serves the production build with the same owner
and data, and `rer doctor` reports tool versions, missing
inputs and where your local state lives. `rer describe` lists
every command and flag. Each verb is also a package script, for example
`npm run dev -- --port 8790`.

### Move or reset your data

Stop the app first. Export writes one private archive; import restores it into
an empty installation.

```sh
rer export --output exports/nook.rer
rer reset --yes
rer import --input exports/nook.rer --yes
```

The archive holds every conversation, message, decision, commitment, file and
attention choice with integrity checks. It leaves out sessions, sign-in links,
push subscriptions/keys/presence, pending deliveries and generated settings. After import, recover the archived people
before setup using the offline procedure in
[Restoring a local archive](OPERATIONS.md#restoring-a-local-archive).
`reset` lists what it will remove and refuses without `--yes`; it keeps source,
dependencies, `exports/` and deploy receipts.

### RER Managed hosting

RER Managed sets up sign-in and notification email automatically. You do not
need a mail provider account or a key to type in. RER assigns
`MAIL_PROVIDER=rer`, `MAIL_FROM`, `MAIL_RELAY_URL` and a private `MAIL_API_KEY`
for the installation and environment. See the
[operator guide](OPERATIONS.md#managed-packaging-owner-claim-and-editor-authority).

Free and Assisted hosting keep their existing Cloudflare deployment and
SendGrid or Resend mail options, with your own provider credentials.

### Deploy to your own Cloudflare account

Set `OWNER_EMAIL`, `MAIL_FROM` and `SENDGRID_API_KEY` in your environment before
the dry run. rer 0.2.25 validates production sign-in configuration before building.

```sh
rer deploy --dry-run
OWNER_EMAIL=you@example.com CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… MAIL_FROM=… SENDGRID_API_KEY=… \
  rer deploy
```

The dry run builds and validates the Worker, assets and every migration with no
provider request. A real deploy creates or reuses the D1 database and Worker
named after this project, applies pending migrations, uploads the build, checks
health and then claims the hosted owner from `OWNER_EMAIL`. Set it to your real
email address at deploy; the local development identity is for this computer.
No manual setup-token step is needed. Open `/signin` at the address `rer deploy`
prints and sign in by email. The hosted front page shows **Sign in** as soon as
the owner is claimed.

To sign in as the hosted owner without email, run this from the checkout that
deployed Nook, using the same Cloudflare credentials:

```sh
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer signin
```

It prints a private link that works once for the recorded owner and expires
within 15 minutes. Open it immediately and keep it private. Use the same
`--environment NAME` if you deployed a named environment.

To update to newer source, run `git pull --ff-only`
and then `rer deploy` again; to remove the deployment, run
`rer deploy --remove --yes`. The commands are in
[Updating and deploying](docs/updating.md). `rer release --repo . --output DIR --dry-run`
runs the Base release checks, including the publication scan.

## Update a local Nook

Run these from your existing checkout:

```sh
rer dev --stop
git pull --ff-only
rer setup
rer dev
```

Setup applies pending migrations and keeps your owner and local data. If setup
is needed after an update, `rer dev` tells you to run `rer setup` before it can
start. Export first if you want a backup; see
[Updating and deploying](docs/updating.md).

Upgrading from **0.2.0** adds migrations `0024_import_redaction_steps.sql`
(resumable imported-reaction erasure) and `0025_owner_signin.sql` (one-time
hosted owner sign-in grants). Export before updating; `rer setup` applies them
locally and `rer deploy` applies them to the existing hosted database. Keep your
private settings and every previously applied migration; never reset populated
state to update.

## Where things live

Local data is in `.wrangler/state`, private settings in `.dev.vars`, CLI
bookkeeping in `.rer/local` and installer drafts in `.seed/installer`. Setup and
build refuse ambiguous or aliased state instead of guessing; see
[OPERATIONS.md](OPERATIONS.md) for recovery.

Product records live in normalized D1 tables and every file's bytes in private
R2. A Durable Object pushes small "something changed" hints to open tabs; the
client then catches up through the authoritative replay API, which rechecks
membership on every read. Upgrading an installation that still holds the old
single workspace document is an explicit, resumable offline conversion in
[OPERATIONS.md](OPERATIONS.md).

Product rules live in `src/family/team-chat`, sign-in and D1 access in
`src/platform`, and routing in `src/server.ts`. The rer CLI, installer and command tooling come from the pinned
`@runeditrun/rer` package. Runtime copies of operator-auth, mail and portability
are recorded in `base-copies.json` and checked by
`node scripts/edition-authoring/cli.mjs verify-base`. Imported history from
other tools keeps its provenance without creating unread, attention or accepted
work; see [IMPORT-APPLY.md](IMPORT-APPLY.md). Managed RER installations add a signed owner claim, the
owner-scoped editor authority API and a pinned trusted-build workflow; see
[OPERATIONS.md](OPERATIONS.md). [CONTRACT.md](CONTRACT.md) states
the product guarantees and [ACCEPTANCE.md](ACCEPTANCE.md) what has been proven.

User guides live in `docs/` and are published at `/docs`.
Add a guide in `docs/site.json` with its Markdown source and navigation label; give every unpublished root Markdown file a reason under `githubOnly`.

## Local storage measurement

`node scripts/storage/measure.mjs --state=PRIVATE_SCALE_STATE --evidence=DIR --messages=1000000 --seconds=900`
runs the built Worker locally with 50 synthetic people signed in through the
ordinary auth routes and 50 live connections, bulk-loads a disclosed test-only
corpus of one million messages, then measures sends from 20 concurrent senders,
search, history, replay, edits, deletions and fanout. If seeding pauses (exit 2),
run the same command again to resume. The report is a measurement, not a
capacity promise.

Web Push and installation controls are in **You**. Push starts off, uses a separate channel from email, and sends visible encrypted alerts through the browser vendor. See [Attention](docs/attention.md), [Privacy](docs/privacy.md), and the operator guide below. Real-device receipt and sleeping-device background clearing remain separate evidence limits.
