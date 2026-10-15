# Nook changes

## Unreleased

Nook pins `@runeditrun/rer` 0.2.20. Hosted removal empties uploaded files and
removes the deployment in one command. The hosted front page reads the durable
owner claim, so it offers Sign in before the separate first-run confirmation.
The claim-state reader is refreshed unchanged from Base 8f8bddb; the existing
Lobby wording and styling stay in place. Nook maps its existing `SENDGRID_API_KEY`
deploy input to the shared `MAIL_API_KEY` Worker binding and reads that binding
for production mail. Existing installations supply their SendGrid inputs once
on this update; subsequent deploys retain the binding. Local instructions and
the README journey request email links through Nook’s sign-in page because
rer 0.2.20 retires `rer outbox` and makes `dev --login` automatic owner entry.

Member erasure accumulates imported-reaction receipt counts across each associated
Slack actor and clears completed actor progress atomically.

## 0.3.0 (2026-10-15)

Changes since 0.2.0. The new migrations are
`0024_import_redaction_steps.sql` and `0025_owner_signin.sql`; both are additive.
Export before updating, preserve your private settings and applied migrations,
then update the source and run `rer setup` locally or `rer deploy` for the same
hosted installation. Never reset populated state to update. See
[Updating and deploying](docs/updating.md) and [RELEASE.json](RELEASE.json).

Nook runs on the published `@runeditrun/rer` 0.2.19 in package mode: `rer` runs
that exact devDependency with the Node and pnpm versions the checkout declares.
Node.js 22 or newer is required to bootstrap `rer`; after that, it manages the
pinned tools.

Decisions and requests now show their version history. Revising a decision has
clearer wording, and channel messages show live reply counts so you can reopen
their threads. **Invite teammates** is available from the sidebar; Team uses
plainer invitation and access wording, and channels are labelled **Public
channel** or **Private channel**. Local invitation links opened in another
browser explain how to unlock the checkout with its development link before
confirming the invitation.

Messages show **Notified** names and, for urgent requests, **Urgent** and the
reason to every current channel member. On phones, the composer stays above the
bottom tabs and the header reads **Decisions & requests**. History and
Decisions & requests controls reference their panels only while those panels
are mounted, including loading and unavailable-message/thread states. A separate
demo mode supports the product demonstration without enabling it on ordinary
deployments.

Member erasure completion waits for the people list to refresh
before showing its receipt, so closing it returns focus to the surviving page
instead of a stale erased-person row.

`rer dev` starts a fresh checkout with a placeholder local owner; local
`rer setup --owner-email you@example.com` is optional and replaces it, keeping the
owner ID and data. `rer deploy` now claims the hosted owner itself once the
deploy is healthy, using a one-time setup token it removes from the Worker
afterwards: a hosted Nook keeps no setup token and your checkout keeps no
`.rer/deploy/production-secrets.json`. An unchanged repeat `rer deploy` writes
nothing. Hosted update is `git pull --ff-only` then `rer deploy`; local update
is `rer dev --stop`, `git pull --ff-only`, `rer setup`, then `rer dev`. Setup
applies pending migrations while keeping the owner and data, and `rer dev`
detects when setup is needed. [Updating and deploying](docs/updating.md)
documents both paths, `rer signin` for owner access with the deployment's
Cloudflare credentials, and `rer deploy --remove --yes` for removal. Base's
owner-signin runtime and additive migration 0025 make that mail-free owner
access available in Nook.
The restore guidance links to the offline
[local archive restore procedure](OPERATIONS.md#restoring-a-local-archive) before setup.
The deploy hook returns the setup token it deployed to `rer`. A failed `rer export --target remote` names the hosted export step
that failed. A workspace first deployed from 0.2.0 still holds an unused setup
token and no owner: its next `rer deploy` claims the owner, and the old
`.rer/deploy/production-secrets.json` can be deleted.

Erasing a person removes their Slack ID from other people's imported reactions
even when the work exceeds one request: the erasure stays pending and continues
in bounded steps until no reaction names them, however large one import is
(an import too big for one request is redacted in pages), and its receipt counts
the messages whose reactions did, a number kept even if a step's progress is
lost. It no longer completes while keeping the ID. Migration 0024 adds Base import-kit's stepwise tables and the
step's place in the pending erasure; the import kit is refreshed unmodified from
Base.

Known issues:

- Invitation links expire after 15 minutes. Invite the same person again if
  their link expired; a longer invitation lifetime is pending in Base.
- Reply counts include live replies only. When every reply has been erased,
  the reply-count link disappears; **Open thread** still reaches the
  **Message deleted** tombstones.

## 0.2.0 (14 October 2026)

Changes since 0.1.0. Migration 0023 is the only new migration; update by
exporting first, fast-forwarding the source, `pnpm install`, then `rer setup`
locally or `rer deploy` for a hosted Nook ([Updating and deploying](docs/updating.md)).

Web Push is a separate opt-in channel alongside email. It sends encrypted alert
payloads directly through the browser vendor's push service. **You** includes
PWA install controls and browser-menu instructions. The service worker displays
visible alerts and caches no requests or private content. Local packet checks
do not prove delivery to a real browser or device.

Erasure covers the new push data: erasing a member also removes their push
devices and presence and their queued Web Push items, erasing a message removes
its queued Web Push items as well as its email items, and erasing a decision or
request now removes its queued email and Web Push items too.

Erasing a person now also reaches imports that were still being applied,
cancels their import previews and withdraws those uploads, and removes the person's Slack ID from every other person's imported reactions while
the other reactors and the counts stay. If that redaction is too large for one
request, the erasure still completes and its receipt says how many imported
messages keep the ID. An import whose only change from an erasure was a removed
reaction can still be undone, and the latest archive holding it still restores.
Imported Slack reactions show as the app's reaction chips.

`rer export --target remote` exports a hosted Nook through the owner's session,
and [Updating and deploying](docs/updating.md) covers claiming the production
owner and moving a deployed workspace to newer public source. A tapped
notification opens its conversation even after a hard reload.

Nook runs the published `@runeditrun/rer` 0.2.1 command line and installer
instead of vendored Base copies, and the installed home page is Base's shared
Lobby in Nook's colours. Browser checks run automated accessibility checks at
desktop and phone widths, including the erasure dialogs; the composer's routing
control and the erasure menu text now pass them.

CONTRACT.md clauses carry published IDs: NOOK-001 to NOOK-015 are the clauses
earlier documents call C1 to C15, with DOCS-001 and ERASURE-001 unchanged.

Everything below shipped in 0.1.0 or earlier.

## New brand and homepage hero

Nook has a new look built from scratch: the lowercase `nook` wordmark with a rose
arch mark holding a slanted ink channel hash (also the favicon), Bricolage Grotesque headlines and Instrument Sans text (both
self-hosted under `public/brand/fonts`, SIL OFL 1.1), ink on warm paper with rose
only in drawings. Brand tokens live once in `src/brand/tokens.css`. The homepage
hero now says "Talk it through. Get it done." beside an illustrated alcove (the
brand's arch, with a pendant lamp, a trailing plant, a note on the wall and a cat
asleep on the window seat) holding one real conversation: Priya's message in
the launch channel, and the request Sam accepted. The header links Docs, Source and Sign in;
the hero offers Get the code and Read the docs, over the line "100% free, open source
alternative to Slack and Microsoft Teams". Two more sections get their own drawings:
"Only what needs you." sets the real What needs you list beside an hourglass with a leaf
sprig, and "Make room for your team." sits under a street of houses with their windows
lit. Every drawing is inline vector art with live text. The rest of the site keeps its current look until the next stages.

The app gets a calm pass, so the conversation is front and center. The messages sit in one centred
column with a one-line composer, and the Decisions and requests panel is closed until the header
Decisions button (with its open count and a "waiting on you" dot) opens it. Per-message actions, reactions,
the card menus and the Remove buttons appear on hover, keyboard focus or a tap, and stay in the page for
screen readers. Reactions show as counts, decisions show as a short line under the message that made them,
and a conversation's options, Details and the member avatars share the header. The rail drops its
tagline and extra buttons: the Channels and Direct messages headings carry the create "+" instead. Attention is a flat list, the
Team admin has its own screen under You, dialogs are quieter sheets that rise from the bottom on a phone, and a
colour system with one hairline, one shadow and four button looks replaces the boxes. Nothing was removed:
every action keeps its name and its place in the tab order, and the server rules are unchanged.

## Imports list at any size, Base 479094f, erasure from import custody

`/imports` lists up to 50 imports from their job rows, so it loads however many
large imports exist; opening an import or acting on it still runs the full
custody checks. Base copies move to 479094f: undo uses Base's reversal fence
(migration 0020), erasing a person tombstones their records in import custody,
journals the erasure and checkpoints restore so an older archive is refused
(0021), and Base's provider controls arrive as 0022. `rer-setup.json` declares
the optional `oidc-provider@1` dependency (`IDENTITY_PROVIDER`).

## Slack export import

Owners import a Slack export ZIP from `/imports`: a wizard reviews people and
channels, apply resumes after interruption, imported history is read-only and
searchable, and undo is guarded against later work. See SLACK-IMPORT.md.

## Managed packaging, owner claim and homepage editor

The Base delivery producer generates `rer-project.json` and the managed workflow,
pinned to the same `runeditrun/delivery` commit as Uptime. A managed install
admits its owner through the signed claim at `/auth/owner-claim`, and the owner
can edit the homepage from the management origin. See OPERATIONS.md.

## Day-one team surfaces

The owner invites people from **You** with a Base operator-auth sign-in link; the
invitation binds when it is accepted. Guests reach only the channels they were
invited to. Deactivating someone ends their sessions and clears their open tabs.
Members browse and join public channels, react to messages and see private image
previews inline. The tab title counts what needs you, and opt-in browser
notifications announce new mentions without message text.

## React client

The workspace is one React client matching the approved channel design at 1440:
rail, conversation, thread and the Decisions & requests panel. At 390 it uses
bottom tabs, a full-screen conversation and the thread as its own view, and the
URL keeps the place for Back and reload. Attention offers Accept and Discuss.
Your own sends are never unread; a message becomes read only when it has been
on screen, and a conversation reopens at its newest message.

## Normalized storage

Conversations, messages, files and attention live in normalized D1 tables;
installs created on migrations 0001–0003 move forward through
`0010_normalized_storage`. Attachments up to 25 MiB
go to R2, a Durable Object fans out change hints to open tabs, and replay from
D1 stays authoritative.

## Command contract

Nook runs through the Base rer command contract. Every public package script is
`node scripts/rer.mjs VERB`; README and AGENTS give the one local journey.
Owners confirm first-run setup at `/setup`. `deploy` performs a real Base
deploy-kit owner-account deployment (dry run included). Base copies are
refreshed to `2cf798939cc600cb7f77657c2048292002fb05d8`.

## Operator sign-in

Base operator-auth with the development outbox replaces password accounts and
open registration. The guided installer and `rer setup` share one root
`rer-setup.json`. Base portability carries export and import.

## Native edition

PART1 promotes the maintained native Worker edition to root, removes the duplicate
Node/SQLite application and composition output pipeline, copies pinned Base inputs,
and records editable source authoring. Native schema4 adds immutable external imports
and archivev4 recovery while preserving applied migrations0001–0003. Existing routes,
package scopes, resource and archive identifiers remain stable. Display naming is
Nook. Complete verification includes native security, media, attention, import,
historical recovery, installer, desktop/mobile, keyboard and homepage behavior.
