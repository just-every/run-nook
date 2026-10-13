# Updating and deploying

Use Node 22.20.0 and pnpm 10.12.4 for the Nook command line.

## Check a deploy locally

Run the dry run before a real deployment:

```sh
rer deploy --dry-run
```

The dry run builds and validates the Worker, assets, migrations and deployment settings without contacting Cloudflare.

## Deploy from the owner's Cloudflare account

The workspace owner supplies a Cloudflare account ID and scoped API token. On the first deployment, the owner also supplies the owner email, mail-from address and SendGrid API key:

```sh
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… OWNER_EMAIL=… MAIL_FROM=… SENDGRID_API_KEY=… \
  rer deploy
```

The deploy command stages the Worker and migrations, creates or reuses the project's D1 database and Worker, applies pending migrations, uploads the build and checks health. It creates the production session secret and setup token once in the private `.rer/deploy/production-secrets.json` file. Keep that file: later deploys reuse it. Production sign-in requires the configured HTTPS origin and mail provider.

A dry run checks the build and settings only. It does not deploy anything, so run the real deploy before you tell your team the workspace is live.

## Claim the production owner

`rer deploy` does not sign anyone in. Claim the new workspace once, from the checkout that deployed it, by sending the setup token to `/auth/bootstrap`. Replace `https://YOUR-NOOK` (twice) with the origin the deploy printed and `Your Name` with the owner's name:

```sh
node -e 'const {SETUP_TOKEN}=require("./.rer/deploy/production-secrets.json");process.stdout.write(JSON.stringify({token:SETUP_TOKEN,displayName:"Your Name"}))' \
  | curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://YOUR-NOOK/auth/bootstrap \
      -H 'Origin: https://YOUR-NOOK' -H 'Content-Type: application/json' --data-binary @-
```

The token goes straight from the file into the request and is never printed. `303` means the owner account for `OWNER_EMAIL` now exists. Then open `https://YOUR-NOOK/signin`, enter that email and follow the link Nook mails you. Any other answer means nothing was claimed: `409` means the workspace already has an owner, and `403` means the token does not match the deployed one.

## Update to newer Nook source

Nook's source is public at https://github.com/just-every/run-nook. To move a deployed workspace to newer source, run these from the checkout that deployed it, in this order.

1. Export the hosted workspace first, so you can return to it ([Backups and export](backups.md) explains the session file):

   ```sh
   rer export --target remote --origin https://YOUR-NOOK --session-file exports/owner.session --output exports/before-update.rer
   ```

2. Get the newer source. `--ff-only` refuses rather than merging when your checkout has its own commits; private settings, `.rer/` and `exports/` are not tracked and stay as they are:

   ```sh
   git pull --ff-only
   ```

3. Install the pinned command line and dependencies of the new source:

   ```sh
   pnpm install
   ```

4. Deploy to the same environment. Use the same Cloudflare account, and the same `--environment NAME` if the first deploy used one. The saved production secrets are reused, so the owner inputs are not needed again:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… rer deploy
   ```

5. Check which source is answering. `deployment.sourceSha` in the health answer must equal the commit you just deployed:

   ```sh
   curl -s https://YOUR-NOOK/health
   git rev-parse HEAD
   ```

Migrations only add to the database, so the existing workspace keeps its data, sessions and settings. If the deploy fails, nothing is removed: fix the cause and run the same deploy again.

Source from before October 14, 2026 has no hosted export, so step 1 is refused for that first update. Before updating such a workspace, note the time: Cloudflare's D1 Time Travel can return the database (not uploaded files) to it. Every later update can start with step 1.
