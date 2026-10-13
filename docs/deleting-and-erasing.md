# Deleting and erasing

Authors can delete their own native messages and remove their own native files. Imported history uses the separate imported-author erasure door described below. Owners and admins can also choose **Erase message**, in the **More** menu of a message, in channels they can currently read. Their role does not give them an erasure button for direct messages.

## Erase a teammate

In **You → Team**, choose **Erase member**. Owners can erase other eligible accounts; admins can erase accounts with the member role, including guest access. You cannot erase yourself or the last active owner.

The preview shows counts without repeating the person's details. Type **ERASE** to confirm. The receipt reports progress and elapsed time. You can close the dialog while accepted work continues. **Pending erasures** lets an eligible operator resume work with their current authority.

Member erasure removes the person's profile and sign-in credentials, invitations, preferences, reads, follows, reactions and attention. It erases their authored messages and files, including those in direct messages. Decisions and commitments they authored retain only their conversation, kind, version count and state. Erasure does not accept or complete work. Other people's messages and work remain, including already accepted commitments; erased assignee and action attribution is removed.

## What remains

Empty message and file positions keep surviving threads navigable. Separate historical actor records can retain an opaque ID where fixed direct-message participants, counters or import ownership need it, without a name, mailbox or credentials. Those structural references remain correlated; they are not an active account. Events lose both personal attribution and subject references. Receipts contain counts, times and a random receipt ID without a person mapping. Retry digests prevent an old send or upload request from recreating erased content.

A Slack source author is a separate imported identity. Owners with current access to every affected imported channel can erase that author under **Team → Imported authors**, including after the original importer leaves. Selected source copies and files are erased; retained original ZIPs for that import are withdrawn because they can contain the erased content. Other authors' visible imported history remains.

## Completion and interrupted files

Nook commits removal and durable file-deletion obligations before deleting file bytes. A receipt stays **pending** until every selected file is confirmed gone. Larger erasures continue in bounded steps. Background continuation requires its initiating operator's session and authority to remain current; another eligible operator can resume it.

An upload interrupted at an uncertain point can keep erasure pending. The installation operator must stop the app and use the paused storage reconciliation procedure in [OPERATIONS.md](../OPERATIONS.md), then resume erasure. A pending receipt is not a completed deletion.

## Backups and restore

Erasure does not rewrite downloaded archives, offline browser copies, provider backups or Time Travel, or physical storage and WAL remnants. Apply your retention policy to those copies.

Every normal export includes a private journal sidecar, for example `exports/nook.rer.journal.rer`. Keep the latest archive and its journal together. Existing installations refuse import into nonempty storage. A fresh destination given a post-erasure archive retains its erasure journal; a fresh destination can also use the owner's latest journal directly:

```sh
NOOK_ERASURE_JOURNAL=exports/latest.rer.journal.rer rer import --input exports/older.rer --yes
```

The journal must be a private file readable only by its owner. Supply it on every attempted import until a post-erasure archive has been successfully restored; a refused import does not save the supplied journal in a fresh destination. An old archive that would restore recorded erased rows is refused. A brand-new installation that has never received a later journal cannot recognize an old archive. See [Backups and export](backups.md) for the normal stopped-installation workflow.
