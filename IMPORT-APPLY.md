# Reviewed historical imports

A workspace owner opens `/imports` and chooses Slack, Campfire or Mattermost.
Nook reads the archive on that computer, withholds source authentication, and
shows the supported records, exact audiences, identities, files and omissions.
No source URL is fetched. Unsupported or incomplete selected history is refused.

After local review, **Create dry run** uploads the normalized capture to Base's
shared import door. **Apply reviewed plan** submits its exact fingerprint and
continues bounded durable batches. A dry run expires after 30 minutes. Changed
source custody or member authority requires a fresh review. Source history stays
inert: no unread activity, messages sent, invitations, live reactions or accepted
work are created. Normal channel and file ACLs apply to every imported read.

The owner screen uses `/api/operator/import/{uploads,plan,apply,status,reconcile,undo}`
with the current session, exact Origin and source namespace. Business uses the
same operations at `/api/rer/import/*`, with signed action-bound grants, explicit
owner opt-in and permanent key revocations. Neither path creates a second kind
of import job. See [the adoption record](IMPORT-DOOR.md) for native bindings and
the documented Base continuation adaptation.

History includes imports made before the door. Guarded Undo removes only owned,
unchanged history; later native work, changed audiences or references refuse
removal. Workspace archives keep the native records, original selected files,
kit custody and import batches. A restored archive keeps Business imports off.
The old capture/preview/apply APIs and per-source importer routes were removed;
legacy archive readers and guarded Undo remain for existing installations.

Source details and bounded fidelity guarantees:

- [Slack](SLACK-IMPORT.md)
- [Campfire](docs/campfire-import.md)
- [Mattermost](docs/mattermost-import.md)
