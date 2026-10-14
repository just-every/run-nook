# Install Nook

Nook runs with the `rer` command. Install `rer` once (it needs Node 22 or later to start):

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
```

`rer` runs each checkout's own pinned copy and provides the Node and pnpm versions Nook needs, so there is nothing else to install or choose.

## Start locally

Get the source, set up the first owner, then start Nook. Replace `EMAIL` and `NAME` with your email address and display name:

```sh
git clone https://github.com/just-every/run-nook.git
cd run-nook
rer setup --owner-email EMAIL --owner-name 'NAME'
rer dev
```

Setup creates private local settings, builds the Worker, applies the local D1 migrations, claims the first owner and stops the app. Start `rer dev` and open the printed `RER_OPEN` link on this computer; it exchanges this checkout's local key for the owner's development session. On a fresh installation, that visit opens `/setup` to confirm the account before Nook opens the workspace. Keep the `RER_OPEN` link private.

## Sign in through the local outbox

`rer dev` prints an `RER_OPEN` link for the owner. To use the email-link sign-in flow instead, start the local outbox mode:

```sh
rer dev --login
```

Open the printed `RER_OPEN` link on this computer to unlock the local outbox, then open `/signin`, request a link, open the newest message in the outbox and choose **Confirm**. The local development mail stays in this checkout; no external mail provider is used for this flow.

## Use the guided installer

If you prefer a browser walkthrough, run `node scripts/install.mjs`. It opens the guided installer for the same local setup. Use [Your team](your-team.md) after setup to invite people and select their channel access.
