# Updating and deploying

Deploy, update and removal are all `rer deploy` run from your Nook checkout. `rer` provides the Node and pnpm versions Nook needs; there is nothing to install or choose first.

## Check a deploy locally

Run the dry run before a real deployment:

```sh
rer deploy --dry-run
```

The dry run builds and validates the Worker, assets, migrations and deployment settings without contacting Cloudflare.

## Deploy to your Cloudflare account

You supply a Cloudflare account ID and a scoped API token. On the first deployment you also supply the mail-from address and a SendGrid API key. Set `OWNER_EMAIL` to the real email address that will own the hosted workspace. Local `rer setup` is optional and is not required for deployment:

```sh
OWNER_EMAIL=you@example.com CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… MAIL_FROM=… SENDGRID_API_KEY=… \
  rer deploy
```

The deploy command stages the Worker and migrations, creates or reuses the project's D1 database and Worker, applies pending migrations, uploads the build and checks health. It generates the production session secret itself and keeps no secret in your checkout. Production sign-in requires the configured HTTPS origin and mail provider.

A dry run checks the build and settings only. It does not deploy anything, so run the real deploy before you tell your team the workspace is live.

## The owner is claimed for you

After the deploy is healthy, `rer deploy` claims the hosted owner from `OWNER_EMAIL` automatically. There is no manual setup-token step. Open the address `rer deploy` printed, enter the owner email at `/signin` and follow the link Nook mails you.

If the owner already exists, the deploy keeps it. If the claim or the token's removal fails, the deploy says so and what to run; running the same `rer deploy` again finishes it.

## Update to newer Nook source

Nook's source is public at https://github.com/just-every/run-nook. To move a deployed workspace to newer source, run these from the checkout that deployed it:

```sh
git pull --ff-only
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer deploy
```

`--ff-only` refuses rather than merging when your checkout has its own commits; private settings, `.rer/` and `exports/` are not tracked and stay as they are. If the new source pins a different `rer`, `rer deploy` installs it first. Use the same Cloudflare account, and the same `--environment NAME` if the first deploy used one. The Worker keeps its secrets, so the mail inputs are not needed again.

Migrations only add to the database, so the existing workspace keeps its data, sessions and settings. If the deploy fails, nothing is removed: fix the cause and run the same deploy again.

Export the hosted workspace first if you want a copy to return to ([Backups and export](backups.md) explains how). Source from before October 14, 2026 has no hosted export; for that first update, note the time instead, because Cloudflare's D1 Time Travel can return the database (not uploaded files) to it.

## Remove a deployment

```sh
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer deploy --remove --yes
```

This deletes the Worker and the D1 database, R2 bucket and any queue that `rer deploy` created for this environment, with their data. Export first if you want to keep your workspace. It refuses without `--yes`. A bucket that still holds files stays: empty it in the Cloudflare dashboard, then run the same command again. Resources `rer deploy` did not create are never touched.
