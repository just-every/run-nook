# Try Nook in isolation

`rer demo` starts a fresh, signed-in Cedar House sample household. The household,
groceries and garden channels show a week's conversations, a shared dinner
decision and shopping and gardening commitments. Alex and Morgan are sample
members; the visitor is the owner. Sample writes use the same auth, invitation,
conversation, message and outcome APIs as the app. No existing workspace is copied.

Run `rer setup` once if needed, then `rer demo`. Open its private `RER_OPEN`
link. `rer demo --stop` destroys the disposable `.rer/demo/` state. A new start
has fresh sample data, and `.wrangler/state` is unchanged.

Base's demo guard is the first server import. In demo mode it blocks outbound
fetch and sockets, including Web Push vendor requests. Sign-in, invitation and
notification mail is captured in the development outbox, including on hosted
HTTPS. Expand the slim Demo strip to see captured mail and refused sends.
Production mail behavior is unchanged when `RER_DEMO` is absent.

The **Run demo** workflow reads the `run-demo` environment. Dispatch `test_only`
to deploy `demo.test.run-nook.com` with Cloudflare's public Turnstile test keys;
use `test_only` and `remove` together to remove that host after measurement.
A production dispatch uses the real Turnstile keys and deploys
`https://demo.run-nook.com/`. Never automate the real challenge. No repository
variable is needed. The workflow uses only the RunEditRun Cloudflare account.

Each hosted visitor gets a private container with no internet. Base owns the
start page, progress, signed owner claim, session lifecycle and teardown.
The declared lifetime is 60 minutes with 15 minutes idle; the known Base/basic
container early-idle and startup-time limitations are tracked upstream.
