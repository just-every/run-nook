# Getting started

Nook runs on your own computer first. Open a terminal (on a Mac, Terminal in Applications → Utilities; on Windows, your WSL2 distribution), copy this line into it and press Enter:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-nook
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-nook` does the same.

The line installs `rer`, the Run Edit Run command, clones Nook into a `run-nook` folder, installs everything, prepares a local database and a placeholder owner, and starts Nook. Open the `RER_OPEN` link it prints, on the same computer, to sign in; on a fresh installation, confirm the account at `/setup` to open the workspace. Keep the link private. This free copy runs only on your computer: it sends no email, and nobody else can open it.

If the installer prints a line that puts `rer` on your PATH, run that line too. To start Nook again later, run the same line from the same folder, or `cd run-nook && rer dev`. `rer dev --stop` stops it.

Next: [Install](install.md) covers your own owner address and inviting a teammate locally, and [Updating and deploying](updating.md) puts Nook on your own Cloudflare account.
