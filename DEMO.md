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

The dispatch-only **Run demo** workflow reads the `run-demo` environment and
uses the RunEditRun Cloudflare account. Dispatch `test_only` for
`demo.test.run-nook.com` with Cloudflare's public Turnstile test keys. Dispatch
`test_only` and `remove` to remove it and read back resource absence. A production
dispatch uses the real widget at `https://demo.run-nook.com/`; never automate
that challenge. No repository variable is needed.

Each visitor gets an isolated container, signed in through Base's signed owner
claim. Public networking is available; account effects are mocked. The demo
ends after 60 minutes or 15 minutes idle, and its container and data are destroyed.
