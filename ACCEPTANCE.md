# Nook acceptance

`rer verify` is the complete local acceptance command. Push CI runs contracts,
unit tests, runtime journeys at both widths, and notifications in four parallel
jobs with 15-minute limits. The full README and realistic pilot fresh-clone
journeys at 1440 and 390 retain every assertion and run nightly, on release tags,
and manually. It covers real Workers and local D1: runtime suites use the emitted build,
while the README and pilot journeys use the ordinary rer development workflow:

- current sessions and conversation ACLs on every API, document and generated
  server function, including expired, revoked and missing sessions;
- exact retry identity, compare-and-swap edits, tombstones and complete replay;
- fixed DMs, owner-controlled channel membership and full-history disclosure;
- decisions with version history and commitments accepted only by the assignee;
- private file staging, binding, download and erasure;
- calm attention (follow, mute, quiet time, snooze, done) independent of unread
  and of accepted work;
- `tests/notify-journey.mjs` (C14 email): a fresh local install with outbox
  sign-in and rer's development outbox as the only mail edge, through public
  doors: email off until a member turns it on (with the keyboard, at 1440 and
  390), one email for a mention while away and for a commitment proposal,
  nothing for a routine follow or during quiet time, urgent requests held or
  let through by the recipient's choice, two mentions folded into one email
  with a count, cancellation after removal from the conversation, deletion of
  the message or deactivation, a refused send retried on schedule and shown as
  "email not delivered" to the sender and the owner before it succeeds once,
  a queued retry surviving a Worker restart, the no-session "turn these off"
  link, and no message text or file name in any email;
- immutable imported history; the supported Base portability v1 recovery is the
  explicit backup-only `rer import --legacy-v1 --input FILE --yes
  --acknowledge-unverified-metadata --output FILE` path. It checks the v1
  checksums, records that the archive's metadata is unverified, restores into an
  empty installation, and writes a fresh v2 archive. The legacy single-workspace
  document conversion and root SQLite/native archive procedures are separate
  offline recovery paths in `OPERATIONS.md`; this is not recovery from every
  earlier format;
- the rer command contract: setup, first-run `/setup`, outbox sign-in, preview,
  doctor, reset, export/import round trip, the guided installer, owner-account
  deploy against a fake Cloudflare account, and a fresh-clone README journey;
- normalized storage: an install from migrations 0001–0003 moving forward, 25 MiB R2 attachments and
  Durable Object fanout with replay from D1;
- two people in two sessions at 1440 and 390: own sends never unread, viewing
  clears unread, Attention Accept and Discuss, threads and URL state;
- day-one team surfaces at 1440 and 390: invitation through the outbox, guest
  scope, deactivation, channel browse and join, reactions, inline image preview,
  tab-title count and retirement of duplicate open-tab OS notifications;
- Slack export import on synthetic fixtures: review, resumable apply,
  imported history and search, guarded undo, and the wizard at 1440 and 390;
- `tests/pilot-journey.mjs`: a fresh local rer install/setup, two ordinary
  outbox-authenticated browser sessions at 1440 and 390, invitation, private
  conversation/file, reviewed realistic Slack history with supplied files and
  an explicit missing-file choice, a complete root/thread/file census, source
  reactions/mentions/edited markers, selected audiences and revocation, unchanged
  unread/attention/mail counts, populated safe/refused undo, and rer export/reset/
  import with identical reexport content;
- desktop (1440) and mobile (390) browser and keyboard journeys and the homepage.

The pilot uses a realistic synthetic fixture shaped from Slack’s documentation: 5,000 source messages over 15 months, 40 source directory entries and six channels (one empty), with threads, bot/app records, files, edits, reactions and administrative records. No real Slack export or Slack account was used. The fixture supports bounded local verification, with no Slack parity claim.

Private inline image evidence is split between `tests/team-image.test.mjs`, which accepts genuine PNG bytes and rejects active content, truncation and corruption, and `tests/team-browser.mjs`, which loads a private image preview through the actual Worker at both widths. `ImagePreview.tsx` fetches the ACL-checked PNG/JPEG endpoint and renders a revocable blob URL; downloads remain forced attachments. These checks do not establish virus scanning.

The separate docs site suite checks manifest coverage and rejects broken pages,
anchors and raw HTML. `docs/site.json` currently publishes 11 public guide
routes. An earlier local browser pass exercised the sidebar, table of contents
and pager at 1440/900/390; its axe check covered the docs home and the long
mobile guide with its menu open.

`node tests/part6.mjs --platform-root PATH` needs a checkout of the platform
repository, so it runs outside verify. It proves the schema-2 artifact, the
signed owner claim, owner/anonymous Lobby equality at 1440 and 390, editor
authority and compiled-source persistence against the emitted Worker. The old
installed-homepage editor, draft and visible-publication checks were retired
when installed `/` became the session-independent Lobby.

The core runtime browser journey uses the repository-pinned axe-core package to
check the conversation with channel/thread routing closed and open, plus the
native message and member erasure dialogs, at 1440 and 390. It fails on serious or
critical axe findings. This bounded check does not cover imported-author
erasure and is not a full accessibility audit or WCAG claim. Hosted operation
on a real Cloudflare account, live mail-provider delivery, capacity beyond local
measurement, integrations and real-team adoption remain unproven. Email has a
local development-outbox journey; C15 Web Push has the bounded local checks
below. Neither establishes delivery to a real inbox, browser or device. The
installable PWA is shipped, but offline operation is not supported: its service
worker caches no requests or private content. There is no native iOS/Android
push transport or paging guarantee. Local synthetic verification is not a
production, parity or adoption claim.


## C15 Web Push evidence boundary

`pnpm test:push` runs the emitted Worker, real local D1 and the real ChatHub alarm. One core public-route flow signs in, registers an owned subscription, opts in, sends a message, and independently verifies VAPID and decrypts the actual outbound RFC 8291 packet at the sole fake network edge. A new conversation then proves read-before-delivery cancellation without relying on folding. Focused public security coverage rejects missing sessions, cross-origin mutations, another account's subscription ownership, non-vendor endpoints, invalid keys and unsupported transports, and checks that responses expose no endpoint/auth/private key.

These are local synthetic checks, not browser-vendor or OS receipt evidence.
Nook ships an installable PWA manifest and service worker, but this does not
prove installation or Web Push delivery on a particular browser or device.
Safari on iPhone/iPad and macOS, Chromium browser and installed-app delivery,
subscription disappearance, real lock-screen appearance, mobile keyboard/a11y
and installed PWA layout remain evidence to collect on real devices. The service
worker caches no requests or private content, so offline operation is not
provided. No native iOS/Android transport exists. WebKit forbids silent Web
Push, so immediate sleeping-device clear/badge-only behavior is explicitly
blocked; foreground read synchronization and badges accompanying visible
alerts are the supported web behavior.
