# Preview shared files

Open Files and choose Preview beside a text/code file, CSV or ZIP. Text and CSV appear as inert text, including any markup or spreadsheet formula. A ZIP shows only entry names and sizes; nothing is extracted to disk, executed or fetched. Previews use the same private, current-membership door as images. Removing access makes the preview unavailable.

Text previews show at most 64 KiB with a visible truncated marker. ZIP previews accept at most 200 entries within the existing bounded ZIP reader: 32 MiB archive, 16 MiB per entry, 64 MiB total expansion and a 200:1 expansion ratio. Malformed or over-bound ZIPs are refused. Long listings are truncated with the same visible marker. Download retains the original bytes and current access rules.

Native upload admission remains unchanged at 25 MiB: plain text/code and CSV supplied as UTF-8 text/plain are accepted. ZIP previews apply to files already admitted through the reviewed import door; a native ZIP upload and a CSV/ZIP composer picker are not built. Imported file custody, export, restore and erasure retain their existing rules.

No file is labeled clean or scanned. Malware scanning, quarantine, owner file-type policy, resumable 1 GiB uploads and office/media previews remain unbuilt. The policy needs consistent enforcement at every existing reservation door, including import custody; it is not partially enforced here.
