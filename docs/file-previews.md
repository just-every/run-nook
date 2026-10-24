# Preview shared files

Open Files and choose Preview beside a text/code file, CSV or ZIP. Text and CSV appear as inert text, including any markup or spreadsheet formula. A ZIP shows only entry names and sizes; nothing is extracted to disk, executed or fetched. Previews use the same private, current-membership door as images. Removing access makes the preview unavailable.

Text previews show at most 64 KiB with a visible truncated marker. ZIP previews accept at most 200 entries within the existing bounded ZIP reader: 32 MiB archive, 16 MiB per entry, 64 MiB total expansion and a 200:1 expansion ratio. Malformed or over-bound ZIPs are refused. Long listings are truncated with the same visible marker. Download retains the original bytes and current access rules.

The composer accepts native files under the owner’s file policy. Larger files and additional file types use ordered, resumable 8 MiB chunks in private R2, with a 1 GiB installation ceiling and a 25 MiB default owner limit. CSV and ZIP files can be attached directly. Preview limits remain separate from upload admission; additional file types download as attachments.

No file is labeled clean or scanned. Malware scanning, quarantine and office/media previews remain unbuilt. A near-1 GiB scale run and live R2 transport proof have not been performed.

## Owner file policy

Open **You → Settings → File policy** to choose a maximum file size or block extensions. The installation ceiling is 1 GiB; the default remains 25 MiB. Matching ignores case, includes compound extensions such as `tar.gz` and checks normalized filenames. Every refusal names its rule. A stale settings page must reload before saving.

The policy applies before new native, clip, imported-file and scheduled-copy bytes reach private storage. Owners cannot change it while a reserved upload or byte writer is outstanding; finish or reconcile that work first. Existing files stay available, and backups carry the policy with the existing files. Readable exports include the non-secret policy.

While either restriction is set, all new history-import capture uploads are refused before staging their embedded bytes. Admitting only permitted embedded files needs a verified metadata-first import door and is not implemented. No files are silently dropped from an import. With the default policy, imported files still cross the same per-file admission before private storage.

This policy does not scan files. Scanning, quarantine and the pluggable installation-owned signature engine remain unbuilt; no file is marked scanned, clean or safe and no external scanning recipient is added.

## Resume an interrupted upload

Retry the unconfirmed upload with the same file. After a reload, reselect that file and choose **Retry upload**. Nook checks its name, size, MIME type and SHA-256 against the saved intent, then continues after the durable chunk receipts. Completion verifies the whole private object before it can be bound to one message. Changing the declared identity or an acknowledged chunk is refused.

Abandoned multipart reservations expire after 24 hours and their recorded parts are aborted by the installation’s alarm. Erasure retains abort custody until cleanup; completed uploads use the existing private file and deletion doors. An uncertain R2 operation can require paused operator reconciliation. Live-provider failure and near-limit scale proof remain pending.
