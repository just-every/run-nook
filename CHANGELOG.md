# Nook changes

## 0.2.0 (14 October 2026)

Changes since 0.1.0. Migration 0023 is the only new migration; update by
exporting first, fast-forwarding the source, `pnpm install`, then `rer setup`
locally or `rer deploy` for a hosted Nook ([Updating and deploying](docs/updating.md)).

Web Push is a separate opt-in channel alongside email. It sends encrypted alert
payloads directly through the browser vendor's push service. **You** includes
PWA install controls and browser-menu instructions. The service worker displays
visible alerts and caches no requests or private content. Local packet checks
do not prove delivery to a real browser or device.

Team and message actions offer native member and message erasure with a preview,
typed confirmation and a receipt. Erasure removes the selected live content,
including from other open tabs. Member erasure also clears notification
preferences, push devices and queued email/Web Push items; message and outcome
erasure clears their queued items too. Portable row fences and erasure journals protect restore paths when
the latest journal is available. Imported-author erasure removes the selected
source copies and files, then withdraws the ZIP copy Nook retained for that
import. After erasure completes, that retained archive cannot be opened or
re-imported. These controls do not erase external archives or physical remnants.

Erasing a person now also reaches imports that were still being applied, and
removes the person's Slack ID from every other person's imported reactions while
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
