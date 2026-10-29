# Nook agent guide

## Run it locally

Start the app in any checkout with `rer dev` (install `rer` once with
`npx -y @runeditrun/rer cli install`). Nook runs in package mode: `rer` runs the
exact `@runeditrun/rer` devDependency this checkout pins, with the Node and pnpm
versions it declares.

```sh
rer dev          # installs, sets up a placeholder local owner on first launch, opens signed in through RER_OPEN (lands on /setup first); --as admin|member|guest|signed-out; --login uses the same automatic entry
rer setup --owner-email you@example.com   # optional: a real local owner; stop dev first, keeps the owner ID and data
rer verify
rer reset --yes
rer export --output exports/nook.rer
rer import --input exports/nook.rer --yes
rer deploy --dry-run
```

`rer describe` lists every other command and flag.

## Working on Nook

Read README.md, CONTRACT.md, OPERATIONS.md and ACCEPTANCE.md first. Nook is a
team workspace: every private read and write checks the caller's current session
and current conversation membership on the server, and owner or admin roles never
open another person's DMs. Decisions keep their version history; a commitment is
accepted only by its assignee; imported history never creates unread, attention
or accepted work.

Keep product policy in `src/family/team-chat`, sign-in and D1 access in
`src/platform` and routing in `src/server.ts`. Files under `scripts/edition-authoring`, `src/base` and the other
paths in `base-copies.json` are byte-exact Base copies: change them only by
refreshing from Base, never by local edits. Migrations are additive; never edit
one that has shipped. After an intentional source change run
`node scripts/edition-authoring/cli.mjs lock`. The CLI and installer come from the exact `@runeditrun/rer` devDependency.
To update them, pin a published package version and refresh the lockfile. Refresh
individual runtime copies from the reviewed Base commit, record them with
`record-base`, then run `verify-base` and `lock`.
Copy no Base tests. `migrations/0005_operator_auth.sql` is an applied migration kept as shipped (it is not a Base copy):
Base's later operator-auth schema changes arrive as new numbered migrations, like `0015_dev_sessions.sql`. Nook's look on the installer, `/setup` and the sign-in confirmation page is `public/rer-theme.css` (tokens and Nook Display/Nook Text fonts; `src/theme.ts` and the installer descriptor point at it). Nook owns its fonts and favicon: `public/fonts/fonts.css`, `public/favicon.svg` and `src/base/font-head.ts`
(not a Base copy) link the fonts and the icon once from the root head, the native sign-in documents and the
first-run page; Base's Outfit default does not apply. Base copies import the names `fontHead` and `fontLinks`
from that file, so they keep their names although the list carries the icon link too.

User guides live in `docs/` and are published at `/docs`.
Add a guide in `docs/site.json` with its Markdown source and navigation label; give every unpublished root Markdown file a reason under `githubOnly`.

Local sign-in is a dev session behind this checkout's dev key (`rer dev` opens signed in; the
personas live in `src/dev/personas.ts` and are admitted by `src/dev/admit.server.ts`; only
`src/server.dev.ts` loads the dev layer, never `src/server.ts`, and `rer build` refuses output that
contains it). Open `RER_OPEN` as the owner first and finish `/setup`. In that
same browser, `/auth/dev/enter?as=member` creates `member@dev.localhost`; return via
`/auth/dev/enter?as=owner` to grant channel access through the channel’s **Details** control, then re-enter
as the member. `admin` and `guest` also have local personas. Arbitrary email
invitations are for hosted installations. Local development sends and stores no
mail and has no mail viewer. Never commit `.dev.vars`,
`.rer/`, `.seed/`, `.wrangler/`, archives or production secrets, and never print
their values. Deploys, provider calls and publication need the owner's approval.
Tests use isolated synthetic workspaces; do not weaken an assertion to make a
change pass.

## Contract regeneration

Lander-Regenerate: node src/base/foundation/runtime/contract-docs.mjs write

Lander-Regenerate: node scripts/edition-authoring/cli.mjs lock

Run the matching contract-docs `check` after generation, then the source-lock check. CONTRACT.md owns acceptance text and status.
