# Try Nook in isolation

`rer demo` starts a fresh, signed-in Cedar House household. Jamie (you), Alex
and Morgan have a week's conversations in household, groceries and garden,
a shared dinner decision, a shopping request for you and completed gardening.
The fixed sample records are built with Nook's domain commands. The hook is
idempotent and never fetches or signs people in through email.

Open the private `RER_OPEN` link. The title and navigation say **Nook Demo**;
there is no injected bar or outbox. `rer demo --stop` destroys the disposable
`.rer/demo/` state. The next start is fresh; `.wrangler/state` is unchanged.

Base's v2 guard is the first server import. Public reads/checks run for real.
External writes, including Web Push, return successful provider responses without
sending. Mail is silently suppressed. Nook has no public URL fetch/check or AI
feature. Effects remain real outside `RER_DEMO`.

The **Run demo** workflow (Base's `run-demo.yml`) reads the `run-demo`
environment (`CLOUDFLARE_ACCOUNT_ID` variable, Cloudflare and Turnstile secrets)
and uses the RunEditRun Cloudflare account. It deploys on pushes to main only
when the `RUN_DEMO_DEPLOY` variable is `true`. Dispatch `test_only` for
`demo.test.run-nook.com` with Cloudflare's public Turnstile test keys; starts
there need the private measurement token. Dispatch `test_only` and `remove` to
remove it and read back resource absence. A production dispatch uses the real
widget at `https://demo.run-nook.com/`; never automate that challenge.

Each visitor gets their own native Worker Loader isolate, signed in through
Base's signed owner claim. Nook's D1 database and `ChatHub` Durable Object run
as SQLite facets in the visitor's storage, `FILES` objects stay in that storage
too, and live updates reach the browser over `/api/live`. Public networking is
available; account effects are mocked. The demo ends after 60 minutes, 15
minutes idle or on sign-out, and the visitor's storage is erased.
