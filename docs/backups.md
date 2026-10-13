# Backups and export

Use the Nook commands to export an archive or restore it into an empty installation.

## Export and import

Stop the local app before moving data. Export to a private path, then import the archive into an empty, stopped destination:

```sh
rer export --output exports/nook.rer
rer import --input exports/nook.rer --yes
```

An archive contains conversations, messages, decisions, commitments, files and attention choices, including actual file bytes. It excludes sessions, sign-in tokens, the owner bootstrap claim, outbox mail and generated settings. After import, use the offline identity mapping in [OPERATIONS.md](../OPERATIONS.md) before setup.

Each archive binds its whole manifest and every part, and import checks that binding before restoring anything. Archives made by earlier Nook versions lack it and a normal import refuses them; upgrade the original installation and export a new archive. If that installation is gone, a new checkout that has not run setup can recover one with `rer import --legacy-v1 --input exports/backup-v1.rer --yes --acknowledge-unverified-metadata --output exports/recovered-v2.rer`. It checks every checksum the old archive carries, restores it, and writes a new archive to keep instead. The old archive's own details (where and when it was made, and its record of erasures) cannot be verified.

Slack imports travel in the genuine archive with their immutable source history, supplied file bytes, provenance, destination membership and guarded import job. The automated pilot stops the local app, exports, resets it to an empty stopped installation, imports the archive and reexports it; it checks that the restored content hash matches the original. The journey uses synthetic Slack-shaped data and makes no claim about a real export, provider account or source parity.

## Keep earlier archives private

Deleting a message from the live workspace does not change an archive or backup created earlier. Keep old archives private and apply your own retention policy to every copy.

Normal exports also save a private erasure journal as `<archive>.journal.rer`. Keep the latest sidecar with your backup. See [Deleting and erasing](deleting-and-erasing.md) for restore refusal and the limit when a new installation has never received a later journal.
