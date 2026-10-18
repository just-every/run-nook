# Real Mattermost export fixture

`populate.mjs` provisions an **empty, disposable, real Mattermost instance** through its REST API. It does not fabricate an export. Run it once per instance with Node 22 or later:

```sh
MATTERMOST_ORIGIN=http://127.0.0.1:8065 node tests/mattermost-import/fixtures/populate.mjs --output /tmp/mattermost-fixture
```

The first account, Maya, becomes the Mattermost system administrator. Every account receives a random ephemeral password; passwords and session tokens stay in process memory and are neither printed nor written. Do not run this against an existing or production server. Failures stop the run; replace the disposable instance before trying again.

The script creates Maya, Leo, Aisha and Sam; Launch and Support teams; public channels and a Maya/Aisha private channel; a Maya/Leo DM; and a Leo/Aisha/Sam group without Maya. Its ten messages include nested replies, three real uploaded text files, Unicode, mentions, standard and custom emoji reactions, saved root/reply/DM posts, and pinned root/reply posts. Leo is also a Launch team/channel administrator. The generated custom emoji uses a tiny PNG image.

`expected.json` contains actual server IDs, message text and timestamps, audiences, role assignments, saved/pinned state, reaction identities, and hashes/sizes of downloaded file and emoji bytes. The script verifies messages, reactions, saved state, pin state and uploaded bytes through the real API before writing it. This file contains no passwords, session tokens or configuration responses. It is fixture evidence, not an import input.

Export from the running server after population. With Mattermost v12, attachments and roles/schemes are included by default:

```sh
docker exec CONTAINER mmctl export create --local
docker exec CONTAINER mmctl export job list --local
docker exec CONTAINER mmctl export job show JOB_ID --local
docker exec CONTAINER mmctl export list --local
docker exec CONTAINER mmctl export download EXPORT_NAME /tmp/mattermost-export.zip --local
docker cp CONTAINER:/tmp/mattermost-export.zip /tmp/mattermost-fixture/mattermost-export.zip
```

The server must have local mode enabled, and the export job must reach `success` before downloading. The v12 ZIP contains `import.jsonl` plus `data/` attachment and emoji bytes. Keep the original export unchanged. Record the pinned container tag, generation run URL and artifact hash alongside it when committing the fixture. A generated `expected.json` alone does not establish a genuine export or successful Nook import.

Authoritative references: [REST API definitions](https://github.com/mattermost/mattermost/tree/v12.0.0/api/v4/source), [bulk schema](https://github.com/mattermost/mattermost/blob/v12.0.0/server/channels/app/imports/import_types.go), [export implementation](https://github.com/mattermost/mattermost/blob/v12.0.0/server/channels/app/export.go), and [v12 mmctl export flags](https://github.com/mattermost/mattermost/blob/v12.0.0/server/cmd/mmctl/commands/export.go).
