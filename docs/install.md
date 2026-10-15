# Install Nook

Install `rer`, clone Nook and start it from the cloned folder:

```sh
npm install -g @runeditrun/rer
git clone https://github.com/just-every/run-nook.git && cd run-nook
rer dev
```

You need Node.js 22 or newer, npm and Git to bootstrap `rer`. Once bootstrapped,
`rer` installs the pinned Node and pnpm Nook needs; no separate pnpm installation
is required.

`rer dev` prepares the private local settings and database and creates a
placeholder development owner. Open the printed `RER_OPEN` link on this computer
to sign in; on a fresh installation, confirm the account at `/setup` to open the
workspace.
Keep the link private.

Local real-owner setup is optional. To replace the placeholder with your email,
stop the app and run:

```sh
rer dev --stop
rer setup --owner-email you@example.com
rer dev
```

Setup keeps the same owner ID and your local data. You can also run setup before
the first `rer dev` to choose the local owner from the start. For hosting,
set `OWNER_EMAIL` to your real email address when you run `rer deploy`; rer claims
the hosted owner automatically, with no manual setup-token step. Sign in by email
at the address deploy prints. See [Updating and deploying](updating.md).

## Sign in through the local outbox

`rer dev` prints an `RER_OPEN` link for the owner. To use the email-link sign-in flow instead, start the local outbox mode:

```sh
rer dev --login
```

Open the printed `RER_OPEN` link on this computer to unlock the local outbox, then open `/signin`, request a link, open the newest message in the outbox and choose **Confirm**. The local development mail stays in this checkout; no external mail provider is used for this flow.

## Use the guided installer

If you prefer a browser walkthrough, run `node scripts/install.mjs`. It opens the guided installer for the same local setup. Use [Your team](your-team.md) after setup to invite people and select their channel access.
