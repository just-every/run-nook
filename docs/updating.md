# Updating and deploying

Run these commands from your Nook checkout. You need npm and Git; `rer` manages the pinned Node and pnpm versions Nook needs.

## Choose release or latest source

For a new checkout, one line installs `rer`, clones the latest source from `main` and starts it:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-nook
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-nook` does the same.

Or clone the fixed **0.4.0 release** instead (the line above installs `rer` if you do not have it yet):

```sh
git clone --branch v0.4.0 https://github.com/just-every/run-nook.git run-nook && cd run-nook
rer dev
```

Choose the one line or the release clone. The release tag leaves Git at a fixed version (a detached HEAD); `git pull --ff-only` below applies to `main`. To move a release checkout to the latest source, stop Nook, export first if you want a backup, then run `git fetch origin` and `git switch main` before following the local or hosted update steps below. Keep any local source changes safe before switching.

## Update a local Nook

Export first if you want a backup ([Backups and export](backups.md)), then run:

```sh
rer dev --stop
git pull --ff-only
rer setup
rer dev
```

To restore an archive you exported earlier, restore it into a checkout of the release it was exported from (that release tag's own clone), then run the update steps above. A fresh clone of newer `main` refuses an older archive with `schema_mismatch` ([Backups and export](backups.md) has the steps).

Setup applies pending migrations and keeps your owner, conversations, files and other local data. If setup is needed after an update, `rer dev` stops and tells you to run `rer setup`. `--ff-only` refuses rather than merging when your checkout has its own commits. Private settings, `.rer/` and `exports/` are not tracked and stay as they are.

## RER Managed hosting

RER Managed sets up sign-in and notification email automatically. You need no mail provider account or key to enter: RER assigns `MAIL_PROVIDER=rer`, `MAIL_FROM`, `MAIL_RELAY_URL` and a private `MAIL_API_KEY` for the installation and environment. Free and Assisted hosting keep their existing provider options; the owner-account Cloudflare deployment instructions follow.

## Check a deploy locally

Stop any local instance in this checkout, then run the dry run before a real deployment.

```sh
MAIL_PROVIDER=none rer deploy --dry-run
```

The dry run builds and validates the Worker, assets, migrations and deployment settings without contacting Cloudflare.

## Deploy to your Cloudflare account

**Or let Run Edit Run host it.** [Run Edit Run](https://app.runeditrun.com/?product=team-workspace&plan=assisted) can set Nook up on your own Cloudflare account and keep it updated; sign-ups are by request for now.

Supply your Cloudflare account ID and a scoped API token. Set `OWNER_EMAIL` to the email address that will own the hosted workspace. The local installer is optional.

```sh
OWNER_EMAIL=you@example.com \
  MAIL_PROVIDER=none \
  CLOUDFLARE_ACCOUNT_ID=… \
  CLOUDFLARE_API_TOKEN=… \
  rer deploy
```

The deploy command stages the Worker and migrations, creates or reuses the project's D1 database and Worker, applies pending migrations, uploads the build and checks health. It generates the production session secret. With `MAIL_PROVIDER=none`, email sign-in, invitations and notifications are unavailable. The owner can still sign in with `rer signin`. To enable SendGrid on a new deployment, leave out `MAIL_PROVIDER=none` and supply a verified `MAIL_FROM` and `SENDGRID_API_KEY`.

A dry run checks the build and settings only. It does not deploy anything, so run the real deploy before you tell your team the workspace is live.

## The owner is claimed for you

After the deploy is healthy, `rer deploy` claims the hosted owner from `OWNER_EMAIL` automatically. There is no manual setup-token step. With email enabled, open the address `rer deploy` printed, enter the owner email at `/signin` and follow the link Nook mails you. With email off, use the command below. The hosted front page shows **Sign in** as soon as the owner is claimed; the separate first-run confirmation follows sign-in.

If the owner already exists, the deploy keeps it. If the claim or the token's removal fails, the deploy says so and what to run; running the same `rer deploy` again finishes it.

## Sign in as the hosted owner without email

From the checkout that deployed Nook, use the same Cloudflare credentials:

```sh
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer signin
```

Use the same `--environment NAME` if the deploy used one. You can also supply credentials with `--env-file FILE`. `rer signin` writes a single-use grant for the recorded owner into the hosted auth database and prints a private link once; it does not save the link. Open it immediately: it works once, expires within 15 minutes and records its use in the owner's audit log. Update and redeploy older Nook source first so its runtime has the owner-signin migration.

## Update to newer Nook source

Nook's source is public at https://github.com/just-every/run-nook. To move a deployed workspace to newer source, run these from the checkout that deployed it:

```sh
git pull --ff-only
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer deploy
```

`--ff-only` refuses rather than merging when your checkout has its own commits; private settings, `.rer/` and `exports/` are not tracked and stay as they are. If the new source pins a different `rer`, `rer deploy` installs it first. Use the same Cloudflare account, and the same `--environment NAME` if the first deploy used one. Keep `MAIL_PROVIDER=none` in the environment when updating a mail-off deployment. For SendGrid, keep the existing mail configuration available when deploying. To update a workspace from Nook 0.3.0 or earlier with SendGrid enabled, supply `MAIL_FROM` and `SENDGRID_API_KEY` so rer can also bind the shared `MAIL_API_KEY`.

Migrations only add to the database, so the existing workspace keeps its data, sessions and settings. If the deploy fails, nothing is removed: fix the cause and run the same deploy again.

Export the hosted workspace first if you want a copy to return to ([Backups and export](backups.md) explains how). Source from before October 14, 2026 has no hosted export; for that first update, note the time instead, because Cloudflare's D1 Time Travel can return the database (not uploaded files) to it.

## Remove a deployment

```sh
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer deploy --remove --yes
```

This removes the Worker and the D1 database, R2 bucket and any queue that `rer deploy` created for this environment, with their data. Export first if you want to keep your workspace. It refuses without `--yes`. Removal empties its R2 bucket, including uploaded files, before deleting it. Resources `rer deploy` did not create are never touched.
