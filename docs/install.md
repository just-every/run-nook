# Install Nook

One line installs `rer`, clones Nook into `run-nook` and starts it:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-nook
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later?
`npx -y @runeditrun/rer dev just-every/run-nook` does the same. If the installer
prints a line that puts `rer` on your PATH, run that line too. To start it again
later, run the same line from the same folder, or `cd run-nook && rer dev`.

Once bootstrapped, `rer` installs the pinned Node and pnpm Nook needs; no separate
pnpm installation is required.

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

## Invite a teammate locally

Start with the owner: open `RER_OPEN` and finish `/setup`, then create a channel.
In the same browser, open `/auth/dev/enter?as=member` to create the independent
local account `member@dev.localhost`. Return to `/auth/dev/enter?as=owner` and
add that member through the channel's **Details** control. Open
`/auth/dev/enter?as=member` again to use the channel as the teammate.

Use `as=admin` or `as=guest` at the same route to try those local personas.
A fresh browser must first open `RER_OPEN`. Local personas use fixed development
addresses; they do not accept invitations addressed to arbitrary email accounts.
Local development sends and stores no email and has no mail viewer.
`rer dev --login` uses the same automatic owner entry as `rer dev`.

## Use the guided installer

If you prefer a browser walkthrough, run `node scripts/install.mjs`. It opens the guided installer for the same local setup. Use [Your team](your-team.md) after setup to try local teammates or invite people to a hosted workspace and select their channel access.
