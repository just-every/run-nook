# Install Nook

Run these commands from a Nook checkout with Node 22.20.0 and pnpm 10.12.4.

## Start locally

Install the pinned project dependencies, set up the first owner, then start Nook:

```sh
rer install
rer setup
rer dev
```

Run setup in a terminal and enter your own email address when prompted. To set your display name too, add `--owner-name` followed by your own name in quotes to `rer setup`.

Setup creates private local settings, builds the Worker, applies the local D1 migrations, claims the first owner and stops the app. Start `rer dev` and open the printed `RER_OPEN` link on this computer; it exchanges this checkout's local key for the owner's development session. On a fresh installation, that visit opens `/setup` to confirm the account before Nook opens the workspace. Keep the `RER_OPEN` link private.

## Sign in through the local outbox

`rer dev` prints an `RER_OPEN` link for the owner. To use the email-link sign-in flow instead, start the local outbox mode:

```sh
rer dev --login
```

Open the printed `RER_OPEN` link on this computer to unlock the local outbox, then open `/signin`, request a link, open the newest message in the outbox and choose **Confirm**. The local development mail stays in this checkout; no external mail provider is used for this flow.

## Use the guided installer

If you prefer a browser walkthrough, run `node scripts/install.mjs`. It opens the guided installer for the same local setup. Use [Your team](your-team.md) after setup to invite people and select their channel access.
