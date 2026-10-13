# Nook native storage operator commands

All commands are local-only. Stop the application first. Keep the existing D1 and R2 persistence directory together. A filesystem operator can read all private content; these are not app-admin APIs.

For a pre-normalized installation, first apply all appended D1 migrations with the existing Base local migration command. Original 0001–0003 stay unchanged. Apply explicit legacy identity recovery (`scripts/local/identity-recovery.mjs`) when needed. Then:

```
node scripts/storage/convert.mjs --paused --persist=.wrangler/state/v3
```

The converter can pause with `--stop-after=staging` or `--stop-after=validation`; repeat the same command to resume. It validates retained IDs/references and byte hashes, refuses changed/corrupt sources, retires sessions, cuts authority over atomically, and removes the old document only on success. An incomplete conversion leaves authority at `legacy` and HTTP product operations refuse. R2 staging is not a public file endpoint.

Normalized export/import use the existing Base `scripts/local/transfer.mjs` entry point, including the FILES binding. Export refuses reserved uploads, incomplete imports or pending deletes rather than pretending to have backed up incomplete media. Restart/retry the original upload/import with its original intent or explicitly remove abandoned native uploads, and allow durable deletion recovery to drain. An offline recovery pass is `node scripts/storage/reconcile.mjs --paused --persist=.wrangler/state/v3`; add `--discard-expired` to explicitly tombstone expired unbound reservations/stages before deleting their objects. After import, recover stable actors with:

```
node scripts/storage/recover-identities.mjs SOURCE.sqlite NEW.sqlite MAPPING.json
```

The mapping explicitly names every retained actor `{owner,users:[{id,email,role}]}`. Existing identity mailbox/role mappings cannot silently change. Passwords, sessions and live provider effects are not restored. Original root archives v1–v4 and native archives v2–v4 continue through `scripts/archive.mjs`'s explicit legacy conversion/restore before identity and normalized conversion.

Run the substantive migration proof on the measurement host with existing dependencies:

```
node tests/storage-migration.mjs
node tests/runtime.mjs --without-browser
```

After emitting the Worker, run the finite real runtime measurement:

```
nice -n 15 node scripts/storage/measure.mjs --state=evidence/nook-1/scale-state --evidence=evidence/nook-1/scale --messages=1000000 --seconds=900
```

Repeat the exact command if it exits 2 with `paused:true`. The private checkpoint contains synthetic session cookies and must not be published. The seed is explicitly TEST-ONLY bulk insertion into the actual local D1 fixture while its Worker is stopped; measured requests go through ordinary HTTP and 50 actual WebSocket connections. The command owns and closes its Worker, sockets and SQLite handles. A smaller diagnostic corpus requires `--smoke`; it is not a 1M-message result. The report contains observed percentiles/throughput/errors/missing/duplicate/gap/fanout and plans, not an invented acceptance threshold. This command has to finish successfully on the host before any capacity claim is made.
