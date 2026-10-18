# Backups and export

Use the Nook commands to export an archive or restore it into an empty installation.

## Export and import

Stop the local app before moving data. Export to a private path, then import the archive into an empty, stopped destination:

```sh
rer export --output exports/nook.rer
rer import --input exports/nook.rer --yes
```

An archive contains conversations, messages, decisions, commitments, files and attention choices, including actual file bytes. It excludes sessions, sign-in tokens, the owner bootstrap claim and generated settings. Before starting the restored app, follow [Restoring a local archive](../OPERATIONS.md#restoring-a-local-archive): take a SQLite backup that includes WAL contents, map every retained person, and replace the original file under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject` with the recovered database while stopped. Keep R2 in place, then run `rer setup` with the mapped owner's mailbox and `rer dev`. `HTTP 409 (identity_recovery_required)` means this recovery step is still needed.

Each archive binds its whole manifest and every part, and import checks that binding before restoring anything. Archives made by earlier Nook versions lack it and a normal import refuses them; upgrade the original installation and export a new archive. If that installation is gone, a new checkout that has not run setup can recover one with `rer import --legacy-v1 --input exports/backup-v1.rer --yes --acknowledge-unverified-metadata --output exports/recovered-v2.rer`. It checks every checksum the old archive carries, restores it, and writes a new archive to keep instead. The old archive's own details (where and when it was made, and its record of erasures) cannot be verified.

## Export a hosted Nook

Before leaving hosting, sign in as a workspace owner and choose **Export your workspace** on Nook's sign-in page, or open `/export` on your own Nook. Download the workspace archive and keep this private `.rer` file alongside the source and deployment download from RER. RER's deployment snapshot alone cannot copy Nook's full-text database or live collaboration storage.

Nook's archive includes the authoritative database records and actual private file bytes. Import rebuilds the full-text search index from the exported messages, including imported and retained history. ChatHub stores only connection frontiers and alarms; conversations, replay history and attention choices live in the exported database. A fresh ChatHub rebuilds its frontiers when people reconnect. Live sockets, credentials and pending notification deliveries do not travel.

Move the browser download into the fresh checkout's `exports/` folder and make it private before importing. The destination must not have run setup:

```sh
chmod 600 exports/nook-workspace.rer
rer import --input exports/nook-workspace.rer --yes
```

Then follow the identity recovery procedure above. Reopen the restored workspace and compare messages, file downloads and search results before stopping the original hosting. The archive's manifest also carries its erasure journal; retain your latest archive when restoring an older one.

You can also call Nook's existing `scripts/local/remote-export.mjs` helper from a checkout with its dependencies installed. It uses the owner-only hosted export door to download authoritative D1 records and private R2 bytes, verifies the archive and saves its erasure journal. `rer export` is local-only and refuses a hosted origin:

1. Sign in to `https://YOUR-NOOK` as an owner. In the browser's developer tools (Application or Storage, then Cookies), copy the value of the `__Host-operator_session` cookie.
2. Save it in a private file. Run this, paste `__Host-operator_session=VALUE` on one line, press Enter, then Ctrl-D:

   ```sh
   mkdir -p exports && (umask 077 && cat > exports/owner.session)
   ```

3. Export:

   ```sh
   node --input-type=module -e '
   import {resolve} from "node:path";
   import {remoteExport} from "./scripts/local/remote-export.mjs";
   const [origin, sessionFile, output] = process.argv.slice(1);
   console.log(await remoteExport({root:process.cwd(), path:resolve(output), origin, sessionFile, store:{report:console.error}}));
   ' https://YOUR-NOOK exports/owner.session exports/nook-hosted.rer
   ```

The file is a working owner sign-in, so delete it when you are done, or sign out in the browser to end that session. Only an active owner's session can export, and the export waits for pending uploads, deletions and imports to finish (it answers `reconcile_pending_object_work_before_export` until they have). A hosted Nook cannot be restored remotely: restore the archive into a new local checkout that has not run setup, with `rer import --input exports/nook-hosted.rer --yes`.

Slack imports travel in the genuine archive with their immutable source history, supplied file bytes, provenance, destination membership and guarded import job. The automated pilot stops the local app, exports, resets it to an empty stopped installation, imports the archive and reexports it; it checks that the restored content hash matches the original. The journey uses synthetic Slack-shaped data and makes no claim about a real export, provider account or source parity.

## Keep earlier archives private

Deleting a message from the live workspace does not change an archive or backup created earlier. Keep old archives private and apply your own retention policy to every copy.

Normal exports also save a private erasure journal as `<archive>.journal.rer`. Keep the latest sidecar with your backup. See [Deleting and erasing](deleting-and-erasing.md) for restore refusal and the limit when a new installation has never received a later journal.
