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

The deploy command stages the Worker and migrations, creates or reuses the project's D1 database and Worker, applies pending migrations, uploads the build and checks health. It creates the production session secret and setup token once in the private `.rer/deploy/production-secrets.json` file. The owner claims the production workspace at `/auth/bootstrap` with that setup token. Production sign-in requires the configured HTTPS origin and mail provider.

A dry run checks the build and settings only. It does not deploy anything, so run the real deploy before you tell your team the workspace is live.
