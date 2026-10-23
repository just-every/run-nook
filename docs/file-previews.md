# Preview shared files

Open Files and choose Preview beside a text/code file, CSV or ZIP. Text and CSV appear as inert text, including any markup or spreadsheet formula. A ZIP shows only entry names and sizes; nothing is extracted to disk, executed or fetched. Previews use the same private, current-membership door as images. Removing access makes the preview unavailable.

Text previews show at most 64 KiB with a visible truncated marker. ZIP previews accept at most 200 entries within the existing bounded ZIP reader: 32 MiB archive, 16 MiB per entry, 64 MiB total expansion and a 200:1 expansion ratio. Malformed or over-bound ZIPs are refused. Long listings are truncated with the same visible marker. Download retains the original bytes and current access rules.

Native upload admission remains unchanged at 25 MiB: plain text/code and CSV supplied as UTF-8 text/plain are accepted. ZIP previews apply to files already admitted through the reviewed import door; a native ZIP upload and a CSV/ZIP composer picker are not built. Imported file custody, export, restore and erasure retain their existing rules.

No file is labeled clean or scanned. Malware scanning, quarantine, owner file-type policy, resumable 1 GiB uploads and office/media previews remain unbuilt. The policy needs consistent enforcement at every existing reservation door, including import custody; it is not partially enforced here.

## Owner file policy

Open **You → Settings → File policy** to lower the maximum file size or block extensions. The installation ceiling is 25 MiB. Matching ignores case, includes compound extensions such as `tar.gz` and checks normalized filenames. Every refusal names its rule. A stale settings page must reload before saving.

The policy applies before new native, clip, imported-file and scheduled-copy bytes reach private storage. Owners cannot change it while a reserved upload or byte writer is outstanding; finish or reconcile that work first. Existing files stay available, and backups carry the policy with the existing files. Readable exports include the non-secret policy.

While either restriction is set, all new history-import capture uploads are refused before staging their embedded bytes. Admitting only permitted embedded files needs a verified metadata-first import door and is not implemented. No files are silently dropped from an import. With the default policy, imported files still cross the same per-file admission before private storage.

This policy does not scan files. Scanning, quarantine and the pluggable installation-owned signature engine remain unbuilt; no file is marked scanned, clean or safe and no external scanning recipient is added.
