# Moving in from Slack

The owner can bring a supported Slack export into Nook through the `/imports` wizard. The import is reviewed before it changes the workspace.

## Review and apply

Upload the export ZIP, review the channel and person associations, choose the audience for each selected channel, and resolve every blocking diagnostic. Apply the reviewed selection. The import is resumable if the process stops, and the owner can inspect the result in channel history and search.

The importer accepts selected public channel history. Private conversations and direct messages are listed as exclusions; they are not imported. Imported messages remain attributed to their source identities and do not create native unread activity, attention or accepted commitments.

## Files and historical details

Slack ZIP exports usually contain file links, not the actual bytes. The review lists each missing filename, source channel, message key and size, plus the number of missing references and their total known size. Run this on your computer to prepare the companion files:

```sh
node scripts/slack-files.mjs export.zip supplied-files
```

This command only lists unique references with their names, sizes and link hosts; it makes no download. Valid files already embedded in the ZIP are marked `supplied` and are not fetched or copied into a competing output path. Supply the remaining files under `supplied-files/files/FILE_ID-name`, or explicitly request fetching with your own token environment-variable name:

```sh
node scripts/slack-files.mjs export.zip supplied-files --fetch --token-env MY_SLACK_DOWNLOAD_TOKEN
```

Use your secret tooling to populate the variable you choose; do not put the token value in the command. Both flags are required. Fetching allows only HTTPS `files.slack.com` on the default port and checks every redirect before sending credentials. It uses the importer's archive and file limits, including 1 MiB per file and five combined file references per message. The [Slack import guide](../SLACK-IMPORT.md) lists the full bounds.

After interruption, rerun the same command. Completed downloads are verified against their saved digests and skipped; the interrupted file restarts from the beginning. Keep `.slack-files/` beside the downloaded `files/` directory for verification, but do not add it to your ZIP. The helper leaves the original ZIP unchanged. If companion files were produced, add only `files/` to a copy of your export and upload the copy:

```sh
cp export.zip export-with-files.zip
(cd supplied-files && zip -r ../export-with-files.zip files)
```

If all files were already supplied, upload the original ZIP without this step. Alternatively, choose **Import without these missing files** and preview again. Every affected message remains visible with `file not supplied: <name>`. This choice is part of the exact reviewed plan. The wizard never fetches Slack links.

Bot and app posts keep their source names and remain external, including when an account association was submitted. Replies and thread broadcasts retain their root, source user mentions show imported names, reactions remain read-only counts, reminder descriptions stay quiet historical text, and current edited text is marked **edited in Slack**. Membership, topic, purpose, rename and pin/unpin system notices are skipped and counted by kind. Unknown types or subtypes name the affected channel and prevent applying that selection. An empty source channel can become an empty private destination.

## Undo

The owner can undo an import while the original channel audience and imported history have not changed in ways that block reversal. Undo removes only the import's own records, files and conversations. It does not delete later native work.

For the exact supported export files, file limits, diagnostics and undo rules, read the [Slack import guide](../SLACK-IMPORT.md).
