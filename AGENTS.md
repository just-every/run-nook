# Nook agent guide

## Run it locally

Start the app this way in any checkout, in this order (install `rer` once with
`npx -y @runeditrun/rer cli install`; it runs the checkout's pinned commands):

```sh
rer install
rer setup --owner-email you@example.com
rer dev          # opens signed in as the owner through RER_OPEN (lands on /setup first); --as admin|member|guest|signed-out; --login uses the outbox
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
`src/platform` and routing in `src/server.ts`. Files under `scripts/base-cli`,
`scripts/base-onboarding`, `scripts/edition-authoring`, `src/base` and the other
paths in `base-copies.json` are byte-exact Base copies: change them only by
refreshing from Base, never by local edits. Migrations are additive; never edit
one that has shipped. After an intentional source change run
`node scripts/edition-authoring/cli.mjs lock`. To move to a newer Base, export the CLI from a
Base checkout (`node <base>/scripts/export-cli.mjs .`), run
`node <base>/edition-authoring/cli.mjs refresh-base <commit> --base <base>`, then `verify-base` and `lock`.
Copy no Base tests. `migrations/0005_operator_auth.sql` is an applied migration kept as shipped (it is not a Base copy):
Base's later operator-auth schema changes arrive as new numbered migrations, like `0015_dev_sessions.sql`. Nook's look on the installer, `/setup` and the sign-in confirmation page is `public/rer-theme.css` (tokens and Inter only; `src/theme.ts` and the installer descriptor point at it). Nook owns its fonts and favicon: `public/fonts/fonts.css`, `public/favicon.svg` and `src/base/font-head.ts`
(not a Base copy) link the fonts and the icon once from the root head, the native sign-in documents and the
first-run page; Base's Outfit default does not apply. Base copies import the names `fontHead` and `fontLinks`
from that file, so they keep their names although the list carries the icon link too.

User guides live in `docs/` and are published at `/docs`.
Add a guide in `docs/site.json` with its Markdown source and navigation label; give every unpublished root Markdown file a reason under `githubOnly`.

Local sign-in is a dev session behind this checkout's dev key (`rer dev` opens signed in; the
personas live in `src/dev/personas.ts` and are admitted by `src/dev/admit.server.ts`; only
`src/server.dev.ts` loads the dev layer, never `src/server.ts`, and `rer build` refuses output that
contains it) or the key-gated Base outbox (`rer dev --login`). Never commit `.dev.vars`,
`.rer/`, `.seed/`, `.wrangler/`, archives or production secrets, and never print
their values. Deploys, provider calls and publication need the owner's approval.
Tests use isolated synthetic workspaces; do not weaken an assertion to make a
change pass.
