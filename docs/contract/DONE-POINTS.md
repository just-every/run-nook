Old reference: `74380c56f0f5ae57106250e7343ba1c546f33c39`.

# Carried-done outcome assertions

The clause-level journey assessment is in [DONE-AUDIT.md](DONE-AUDIT.md). This supporting census retains every acceptance outcome and its original assertion or missing-proof boundary.

| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| NOOK-001 | old 1 | HTTP refusal after session revoke (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | old 1 | SSR refusal after session revoke (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | old 1 | search refusal after session revoke (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | old 1 | replay refusal after session revoke (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | old 1 | generated-loader refusal after session revoke (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | old 1 | session-expiry private-read refusal (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | old 1 | session-expiry private-write refusal (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-001 | 1 | participant-removal private-read refusal | none | none |
| NOOK-001 | 1 | participant-removal private-write refusal | none | none |
| NOOK-001 | 1 | unrelated-admin DM refusal | none | none |
| NOOK-002 | 1 | one committed message for retries | `tests/storage-flows.mjs:5` | asserted |
| NOOK-002 | 1 | original retry result after lost acknowledgment | none | none |
| NOOK-002 | 1 | changed-payload conflict | none | none |
| NOOK-002 | 1 | per-conversation ordering | none | none |
| NOOK-002 | 2 | racing-edit version conflict | none | none |
| NOOK-002 | 2 | delete tombstone | `tests/storage-flows.mjs:21` | asserted |
| NOOK-002 | 2 | deleted body absent from replay | `tests/storage-flows.mjs:7` | asserted |
| NOOK-003 | 1 | app-created channel | none | none |
| NOOK-003 | 1 | app-created private channel | none | none |
| NOOK-003 | 1 | app-created DM | none | none |
| NOOK-003 | 1 | history disclosure before adding a member | none | none |
| NOOK-003 | 1 | new member reads earlier history | none | none |
| NOOK-003 | 2 | removed member history refusal | none | none |
| NOOK-003 | 2 | removed member search refusal | none | none |
| NOOK-003 | 2 | removed member replay refusal | none | none |
| NOOK-003 | 2 | removed member file refusal | none | none |
| NOOK-003 | 2 | DM participant change refusal | none | none |
| NOOK-003 | 2 | unrelated-admin DM refusal | none | none |
| NOOK-004 | 1 | recorded discussion decision | none | none |
| NOOK-004 | 1 | proposed commitment | none | none |
| NOOK-004 | 2 | another-participant decision-revision refusal | none | none |
| NOOK-004 | 2 | non-assignee acceptance refusal | none | none |
| NOOK-004 | 2 | exact-version assignee acceptance | none | none |
| NOOK-004 | 2 | assignee completion report | `tests/storage-flows.mjs:6` | asserted |
| NOOK-004 | 3 | reopened immutable history | none | none |
| NOOK-004 | 3 | human author displayed | none | none |
| NOOK-004 | 3 | source context displayed | none | none |
| NOOK-004 | 3 | reported status displayed | none | none |
| NOOK-005 | 1 | two-session thread reads | none | none |
| NOOK-005 | 1 | reconnect preserves monotonic unread | none | none |
| NOOK-005 | 1 | own sends excluded from unread | `tests/storage-flows.mjs:5` | asserted |
| NOOK-005 | 2 | beyond-frontier read marker refused | none | none |
| NOOK-005 | 2 | closing Attention does not accept work | none | none |
| NOOK-005 | 2 | closing Attention does not mark unseen messages read | `tests/storage-flows.mjs:63` | asserted |
| NOOK-006 | 1 | stopped empty-installation command restore | none | none |
| NOOK-006 | 1 | explicit identity recovery | none | none |
| NOOK-006 | 1 | equivalent conversations | none | none |
| NOOK-006 | 1 | equivalent memberships | none | none |
| NOOK-006 | 1 | equivalent outcome versions | none | none |
| NOOK-006 | 1 | equivalent Attention | none | none |
| NOOK-006 | 1 | equivalent downloaded file bytes | none | none |
| NOOK-006 | 2 | populated destination refused | `tests/recovery.test.mjs:33` | asserted |
| NOOK-006 | 2 | altered checksum refused | none | none |
| NOOK-006 | 2 | invalid graph refused | none | none |
| NOOK-006 | 2 | old delivery not revived | none | none |
| NOOK-006 | 2 | old session not revived | `tests/recovery.test.mjs:32` | asserted |
| NOOK-007 | old 1 | active markup inert (shared duty BASE-INPUT-001/002) | `CONTRACT.md` Shared duties | moved |
| NOOK-007 | old 1 | malformed body refused (shared duty BASE-INPUT-001/002) | `CONTRACT.md` Shared duties | moved |
| NOOK-007 | old 1 | oversized body refused (shared duty BASE-INPUT-001/002) | `CONTRACT.md` Shared duties | moved |
| NOOK-007 | old 1 | invalid body commits no writes (shared duty BASE-INPUT-001/002) | `CONTRACT.md` Shared duties | moved |
| NOOK-007 | 2 | cross-origin mutation refused | none | none |
| NOOK-007 | old 2 | foreign session refused (shared duty BASE-ACCESS-002) | `CONTRACT.md` Shared duties | moved |
| NOOK-007 | 2 | unsafe local origin refused | none | none |
| NOOK-007 | 2 | production has no dev admission | none | none |
| NOOK-009 | 1 | stopped local command restore | none | none |
| NOOK-009 | 1 | explicit local identity recovery | none | none |
| NOOK-009 | 1 | equivalent local records | none | none |
| NOOK-009 | 1 | equivalent local private media bytes | none | none |
| NOOK-009 | 1 | equivalent local erasure journal | none | none |
| NOOK-009 | 2 | hosted owner download through both documented paths | none | none |
| NOOK-009 | 2 | hosted archive D1 records | none | none |
| NOOK-009 | 2 | hosted archive R2 bytes | none | none |
| NOOK-009 | 2 | hosted archive local identity recovery | none | none |
| NOOK-009 | 2 | equivalent hosted records | none | none |
| NOOK-009 | 2 | equivalent hosted file bytes | none | none |
| NOOK-009 | 2 | rebuilt hosted search | none | none |
| NOOK-009 | 2 | equivalent hosted erasure journal | none | none |
| NOOK-009 | 3 | non-owner hosted refusal | none | none |
| NOOK-009 | 3 | expired hosted-session refusal | none | none |
| NOOK-009 | 3 | remote restore refusal | none | none |
| NOOK-009 | 4 | local archive contains private records | none | none |
| NOOK-009 | 4 | local archive contains media | none | none |
| NOOK-009 | 4 | hosted archive contains private records | none | none |
| NOOK-009 | 4 | hosted archive contains media | none | none |
| NOOK-009 | 4 | live credentials absent from both archives | none | none |
| NOOK-009 | 4 | devices absent from both archives | none | none |
| NOOK-009 | 4 | pending deliveries absent from both archives | none | none |
| NOOK-010 | 1 | material text revision renews acceptance | `tests/storage-flows.mjs:6` | asserted |
| NOOK-010 | 1 | deadline revision renews acceptance | none | none |
| NOOK-010 | 1 | new version binds acceptance | none | none |
| NOOK-010 | 2 | explicit cancellation | none | none |
| NOOK-010 | 2 | fresh proposal changes assignee | none | none |
| NOOK-010 | 3 | stale acceptance refusal | none | none |
| NOOK-010 | 3 | cross-conversation move refusal | none | none |
| NOOK-010 | 3 | author completion impersonation refused | none | none |
| NOOK-010 | 3 | cancellation terminal in history | none | none |
| NOOK-010 | 3 | deleted source body absent | `tests/storage-flows.mjs:6` | asserted |
| NOOK-011 | 1 | complete paged history | `tests/storage-flows.mjs:7` | asserted |
| NOOK-011 | 1 | missed edit restored on reconnect | `tests/storage-flows.mjs:40` | asserted |
| NOOK-011 | 1 | missed delete restored on reconnect | none | none |
| NOOK-011 | 2 | revoked cached retry denied before lookup | none | none |
| NOOK-011 | 2 | no missing durable history | none | none |
| NOOK-011 | 2 | no duplicate durable history | none | none |
| NOOK-012 | 1 | ordered file binding in app | `tests/storage-flows.mjs:38` | asserted |
| NOOK-012 | 1 | private image preview | none | none |
| NOOK-012 | 1 | authorized exact-byte download | `tests/storage-flows.mjs:38` | asserted |
| NOOK-012 | 2 | outsider denied | none | none |
| NOOK-012 | 2 | removed member denied | none | none |
| NOOK-012 | 2 | active input refused | none | none |
| NOOK-012 | 2 | corrupt input refused | `tests/team-image.test.mjs:8` | asserted |
| NOOK-012 | 2 | oversized input refused | none | none |
| NOOK-012 | 2 | lost-put retry preserves bytes | `tests/storage-flows.mjs:39` | asserted |
| NOOK-012 | 2 | file deletion removes bytes | none | none |
| NOOK-012 | 2 | backup file round trip | none | none |
| NOOK-013 | 1 | thread follow at both widths | none | none |
| NOOK-013 | 1 | channel mute at both widths | none | none |
| NOOK-013 | 1 | explicit mention routing | none | none |
| NOOK-013 | 1 | urgent-request routing | none | none |
| NOOK-013 | 1 | snooze at both widths | none | none |
| NOOK-013 | 1 | done triage at both widths | none | none |
| NOOK-013 | 1 | quiet time at both widths | none | none |
| NOOK-013 | 2 | restart preserves preferences | `tests/storage-flows.mjs:63` | asserted |
| NOOK-013 | 2 | another session preserves preferences | none | none |
| NOOK-013 | 2 | due items return under current ACL | none | none |
| NOOK-013 | 2 | triage does not accept work | `tests/attention.mjs:33` | asserted |
| NOOK-013 | 2 | reads do not accept work | none | none |
| NOOK-013 | 3 | authored automatic follow | none | none |
| NOOK-013 | 3 | reply automatic follow | none | none |
| NOOK-013 | 3 | mentioned automatic follow | none | none |
| NOOK-013 | 3 | one-to-one-DM automatic follow | none | none |
| NOOK-013 | 3 | explicit unfollow ends automatic follow | none | none |
| NOOK-014 | 1 | member opt-in | `tests/notify-journey.mjs:43` | asserted |
| NOOK-014 | 1 | mention email | `tests/notify-journey.mjs:54` | asserted |
| NOOK-014 | 1 | commitment-proposal email | `tests/notify-journey.mjs:71` | asserted |
| NOOK-014 | 1 | burst folding | `tests/notify-journey.mjs:67` | asserted |
| NOOK-014 | 1 | quiet-time hold | `tests/notify-journey.mjs:26` | asserted |
| NOOK-014 | 1 | read-item cancellation | none | none |
| NOOK-014 | 1 | deleted-item cancellation | `tests/notify-journey.mjs:26` | asserted |
| NOOK-014 | 1 | revoked-item cancellation | `tests/notify-journey.mjs:26` | asserted |
| NOOK-014 | 1 | retry survives restart | `tests/notify-journey.mjs:25` | asserted |
| NOOK-014 | 1 | definite refusal visible | none | none |
| NOOK-014 | 1 | uncertainty visible | none | none |
| NOOK-014 | 1 | scanner-safe unsubscribe | `tests/notify-journey.mjs:144` | asserted |
| NOOK-014 | 2 | mail has no private body | `tests/notify-journey.mjs:151` | asserted |
| NOOK-014 | 2 | mail has no file name | `tests/notify-journey.mjs:151` | asserted |
| DOCS-001 | 1 | guides build | `tests/docs-site.test.mjs:55` | asserted |
| DOCS-001 | 1 | guides open through browser | none | none |
| DOCS-001 | 1 | all declared pages rendered | `tests/docs-site.test.mjs:56` | asserted |
| DOCS-001 | 1 | links resolve | `tests/docs-site.test.mjs:62` | asserted |
| DOCS-001 | 1 | anchors resolve | `tests/docs-site.test.mjs:62` | asserted |
| DOCS-001 | 1 | raw HTML inert | `tests/docs-site.test.mjs:95` | asserted |
| DOCS-001 | 1 | all Markdown sources accounted for | `tests/docs-site.test.mjs:47` | asserted |
| DOCS-001 | 2 | Lobby route preserved | none | none |
| DOCS-001 | 2 | private-workspace route preserved | none | none |
| ERASURE-001 | 1 | count preview through Team | none | none |
| ERASURE-001 | 1 | count preview through message door | none | none |
| ERASURE-001 | 1 | explicit confirmation | none | none |
| ERASURE-001 | 1 | pending job continuation | none | none |
| ERASURE-001 | 2 | unrelated DM denied | none | none |
| ERASURE-001 | 2 | insufficient role denied | none | none |
| ERASURE-001 | 2 | self erasure denied | none | none |
| ERASURE-001 | 2 | last owner denied | none | none |
| ERASURE-001 | 3 | native content removed | none | none |
| ERASURE-001 | 3 | imported content removed | none | none |
| ERASURE-001 | 3 | R2 absence verified | none | none |
| ERASURE-001 | 3 | only declared structural tombstones retained | none | none |
| ERASURE-001 | 3 | audit anonymized | none | none |
| ERASURE-001 | 3 | old archive refused with newer journal | none | none |
| NOOK-016 | 1 | two-person app create and join at both widths | none | none |
| NOOK-016 | 1 | root messages exchanged | none | none |
| NOOK-016 | 1 | thread replies exchanged | none | none |
| NOOK-016 | 1 | reactions exchanged | none | none |
| NOOK-016 | 1 | thread permalink survives reload | none | none |
| NOOK-016 | 1 | own edit | none | none |
| NOOK-016 | 1 | own delete | none | none |
| NOOK-016 | 2 | outsider private discovery refused | none | none |
| NOOK-016 | 2 | guest discovery limited | none | none |
| NOOK-016 | 2 | guest scope expansion refused | none | none |
| NOOK-016 | 3 | public-channel leave removes navigation | none | none |
| NOOK-016 | 3 | private-channel leave removes navigation | none | none |
| NOOK-016 | 3 | leave removes unread | none | none |
| NOOK-016 | 3 | leave removes notification routing | none | none |
| NOOK-016 | 3 | public rejoin | none | none |
| NOOK-016 | 3 | private rejoin without manager refused | none | none |
| NOOK-016 | 3 | mandatory-channel leave refused | none | none |
| NOOK-017 | 1 | formatted text and code | none | none |
| NOOK-017 | 1 | attachment composition | none | none |
| NOOK-136 | 1 | draft resumes on each supported client | none | none |
| NOOK-017 | 1 | interrupted send has one effect | none | none |
| NOOK-017 | 2 | 50000-character snippet-or-split choice | none | none |
| NOOK-017 | 2 | one previewable snippet message | `tests/composition-browser.mjs:76` | asserted |
| NOOK-017 | 2 | 40001-character API refusal | none | none |
| NOOK-017 | 2 | 40000-character API message whole | none | none |
| NOOK-017 | 3 | bold conversion | none | none |
| NOOK-017 | 3 | italic conversion | none | none |
| NOOK-017 | 3 | strike conversion | `tests/composition-browser.mjs:59` | asserted |
| NOOK-017 | 3 | inline-code conversion | none | none |
| NOOK-017 | 3 | fenced-code conversion | none | none |
| NOOK-017 | 3 | quote conversion | `tests/composition-browser.mjs:62` | asserted |
| NOOK-017 | 3 | list conversion | none | none |
| NOOK-017 | 3 | one undo restores literal characters | none | none |
| NOOK-017 | 3 | plain-text export retains content | none | none |
| NOOK-136 | 2 | account-isolated drafts | none | none |
| NOOK-136 | 2 | workspace-isolated drafts | `tests/workspaces-browser.mjs:80` | asserted |
| NOOK-137 | 1 | mark unread | none | none |
| NOOK-091 | 1 | status and time-zone change | none | none |
| NOOK-091 | 1 | work acceptance unchanged | none | none |
| NOOK-091 | 2 | thirty-minute status expiry | none | none |
| NOOK-091 | 2 | expiry visible on another client | none | none |
| NOOK-091 | 2 | expiry survives restart | none | none |
| NOOK-135 | 1 | title field definition and value | none | none |
| NOOK-135 | 1 | phone field definition and value | none | none |
| NOOK-135 | 1 | manager field definition and value | none | none |
| NOOK-135 | 1 | department-filter result at both widths | none | none |
| NOOK-135 | 1 | guest people scope | none | none |
| NOOK-135 | 1 | hidden field absent | `tests/profiles.mjs:22` | asserted |
| NOOK-092 | 1 | built-in commands precede app commands | none | none |
| NOOK-092 | 2 | remind command equals menu action | none | none |
| NOOK-092 | 2 | invite command equals menu action | none | none |
| NOOK-092 | 2 | topic command equals menu action | none | none |
| NOOK-092 | 2 | rename command equals menu action | none | none |
| NOOK-092 | 2 | mute command equals menu action | none | none |
| NOOK-092 | 2 | quiet command equals menu action | none | none |
| NOOK-092 | 2 | status command equals menu action | none | none |
| NOOK-092 | 2 | DM command equals menu action | none | none |
| NOOK-092 | 2 | huddle command equals menu action | none | none |
| NOOK-092 | 2 | GIF command equals menu action | none | none |
| NOOK-092 | 2 | shrug command equals menu action | none | none |
| NOOK-092 | 2 | collapse command equals menu action | none | none |
| NOOK-092 | 2 | leave command equals menu action | none | none |
| NOOK-092 | 2 | each command same permission check | none | none |
| NOOK-092 | 2 | each command same audit | none | none |
| NOOK-092 | 2 | forbidden rename private reason | `tests/composition-browser.mjs:88` | asserted |
| NOOK-092 | 2 | unknown command posts nothing | `tests/composition-browser.mjs:91` | asserted |
| NOOK-092 | 2 | unknown command offers send-as-text | none | none |
| NOOK-093 | 1 | unsent draft visible across conversations | `tests/personal-browser.mjs:40` | asserted |
| NOOK-093 | 1 | scheduled message visible | none | none |
| NOOK-093 | 1 | scheduled time editable there | none | none |
| NOOK-093 | 1 | yesterday sent message visible | none | none |
| NOOK-138 | 1 | installation-isolated drafts | `tests/workspaces-browser.mjs:80` | asserted |
| NOOK-138 | 1 | installation-isolated cached state | none | none |
| NOOK-138 | 1 | installation-isolated notifications | none | none |
| NOOK-138 | 1 | new installation confirmation | `tests/workspaces-browser.mjs:62` | asserted |
| NOOK-138 | 1 | forgetting another installation keeps sessions | `tests/workspaces-browser.mjs:104` | asserted |
| NOOK-019 | 1 | imported reply found | `tests/search.mjs:69` | asserted |
| NOOK-019 | 1 | PDF phrase found | none | none |
| NOOK-019 | 1 | text-file phrase found | none | none |
| NOOK-019 | 1 | author filter | none | none |
| NOOK-019 | 1 | date filter | none | none |
| NOOK-019 | 1 | channel filter | none | none |
| NOOK-019 | 1 | context opens on each client | none | none |
| NOOK-019 | 2 | short Q3 authorized-message matches | none | none |
| NOOK-019 | 2 | short HR authorized-message matches | none | none |
| NOOK-019 | 2 | short Q3 authorized-file matches | none | none |
| NOOK-019 | 2 | short HR authorized-file matches | none | none |
| NOOK-019 | 3 | 80000-message complete census | none | none |
| NOOK-019 | 3 | no duplicates | none | none |
| NOOK-019 | 3 | no omissions | none | none |
| NOOK-019 | 3 | revoked snippets absent | none | none |
| NOOK-019 | 3 | deleted-file snippets absent | `tests/search.mjs:46` | asserted |
| NOOK-019 | 3 | revoked counts recomputed | none | none |
| NOOK-019 | 3 | cached results revoked | none | none |
| NOOK-019 | 4 | typed and structured filters equal | none | none |
| NOOK-019 | 4 | modifier chips | none | none |
| NOOK-019 | 4 | September in searcher time zone | `tests/search.mjs:37` | asserted |
| NOOK-019 | 4 | negative-word exclusion | `tests/search.mjs:27` | asserted |
| NOOK-019 | 5 | native file in private Files tab | none | none |
| NOOK-019 | 5 | imported file in private Files tab | none | none |
| NOOK-019 | 5 | non-member Files tab absent | none | none |
| NOOK-019 | 5 | non-member workspace files absent | none | none |
| NOOK-020 | 1 | saved DM recovered after restart | `tests/saved-search.mjs:41` | asserted |
| NOOK-020 | 1 | channel pin recovered after restart | `tests/saved-search.mjs:43` | asserted |
| NOOK-020 | 1 | saved item visible on another device | none | none |
| NOOK-020 | 1 | membership removal tombstones save | `tests/saved-search.mjs:48` | asserted |
| NOOK-020 | 1 | source erasure tombstones save | `tests/saved-search.mjs:55` | asserted |
| NOOK-020 | 2 | another person cannot list private save | `tests/saved-search.mjs:39` | asserted |
| NOOK-020 | 2 | unavailable item has no excerpt | `tests/saved-search.mjs:48` | asserted |
| NOOK-033 | 1 | personal reminder scheduled | none | none |
| NOOK-033 | 1 | recurring channel reminder scheduled | none | none |
| NOOK-033 | 1 | runs with all clients closed | none | none |
| NOOK-033 | 1 | restart before due | none | none |
| NOOK-033 | 2 | one due reminder | none | none |
| NOOK-033 | 2 | snooze | none | none |
| NOOK-033 | 2 | edit | none | none |
| NOOK-033 | 2 | cancel | none | none |
| NOOK-033 | 2 | revoked creator causes no later unauthorized post | none | none |
| NOOK-033 | 3 | weekday natural-language recurrence | `tests/reminders.mjs:59` | asserted |
| NOOK-033 | 3 | 0900 creator time zone | `tests/reminders.mjs:59` | asserted |
| NOOK-033 | 3 | no weekend occurrence | none | none |
| NOOK-033 | 3 | DST transition | none | none |
| NOOK-033 | 3 | twenty-minute relative reminder | none | none |
| NOOK-033 | 3 | one relative occurrence | none | none |
| NOOK-033 | 3 | ambiguous parse asks again | none | none |
| NOOK-033 | 3 | ambiguous parse saves nothing | none | none |
| NOOK-034 | 1 | one-off schedule | none | none |
| NOOK-034 | 1 | weekly recurrence | none | none |
| NOOK-034 | 1 | DST time change | none | none |
| NOOK-034 | 1 | restart at due time | none | none |
| NOOK-034 | 1 | replayed scheduler claim | none | none |
| NOOK-034 | 2 | one post per occurrence | `tests/scheduled.mjs:34` | asserted |
| NOOK-034 | 2 | pause prevents posts | none | none |
| NOOK-034 | 2 | cancel prevents posts | none | none |
| NOOK-034 | 2 | removed posting access prevents posts | none | none |
| NOOK-034 | 2 | failure remains visible | none | none |
| NOOK-035 | 1 | channel recap | `tests/search.mjs:170` | asserted |
| NOOK-035 | 1 | thread recap | `tests/search.mjs:180` | asserted |
| NOOK-035 | 1 | contradictory source handling | none | none |
| NOOK-035 | 1 | each factual point matches source link | `tests/search.mjs:173` | asserted |
| NOOK-035 | 1 | revocation before display refuses recap | none | none |
| NOOK-035 | 1 | private correction | none | none |
| NOOK-035 | 1 | dismissal | none | none |
| NOOK-035 | 1 | source messages unchanged | none | none |
| NOOK-035 | 1 | no private snippet | `tests/search.mjs:192` | asserted |
| NOOK-035 | 1 | no invented acceptance | `tests/search.mjs:185` | asserted |
| NOOK-035 | 2 | current-authorized range | none | none |
| NOOK-035 | 2 | omission count | `tests/search.mjs:171` | asserted |
| NOOK-035 | 2 | freshness | none | none |
| NOOK-035 | 2 | uncertainty | none | none |
| NOOK-035 | 2 | model does not create work acceptance | `tests/search.mjs:185` | asserted |
| NOOK-035 | 3 | private feedback attribution | none | none |
| NOOK-035 | 3 | feedback erasure | none | none |
| NOOK-035 | 3 | feedback readable export | `tests/search.mjs:197` | asserted |
| NOOK-035 | 3 | feedback archive restore | none | none |
| NOOK-035 | 4 | organization-label recheck | none | none |
| NOOK-035 | 4 | AI-policy recheck | none | none |
| NOOK-044 | 1 | genuine upstream Campfire fixture | none | none |
| NOOK-044 | 1 | open-room history | none | none |
| NOOK-044 | 1 | closed-room history | none | none |
| NOOK-044 | 1 | DM audience | none | none |
| NOOK-044 | 1 | upload bytes preserved | none | none |
| NOOK-044 | 1 | outsider denied | none | none |
| NOOK-044 | 2 | incomplete backup refused | none | none |
| NOOK-044 | 2 | unsupported backup refused | none | none |
| NOOK-044 | 2 | resume | none | none |
| NOOK-044 | 2 | guarded undo | none | none |
| NOOK-046 | 1 | genuine upstream Mattermost fixture | none | none |
| NOOK-046 | 1 | two-team source | none | none |
| NOOK-046 | 1 | private-channel source | none | none |
| NOOK-046 | 1 | DM source | none | none |
| NOOK-046 | 1 | replies | none | none |
| NOOK-046 | 1 | saved items | none | none |
| NOOK-046 | 1 | pinned items | none | none |
| NOOK-046 | 1 | attachment bytes | none | none |
| NOOK-046 | 2 | reviewed role mapping | none | none |
| NOOK-046 | 2 | complete declared-item census | none | none |
| NOOK-046 | 2 | outsider denied | none | none |
| NOOK-046 | 2 | resume | none | none |
| NOOK-046 | 2 | undo preserves native messages | none | none |
| NOOK-047 | 1 | member conversation export | none | none |
| NOOK-047 | 1 | all current member conversations and DMs | none | none |
| NOOK-047 | 1 | never-joined private content absent | none | none |
| NOOK-047 | 1 | left private content absent | none | none |
| NOOK-047 | 1 | revoked export access refused | none | none |
| NOOK-047 | 2 | default-off workspace export refused | none | none |
| NOOK-047 | 3 | every active member announcement | `tests/readable-export.test.mjs:128` | asserted |
| NOOK-047 | 3 | owner identity audited | none | none |
| NOOK-047 | 3 | change time audited | none | none |
| NOOK-047 | 3 | policy version audited | none | none |
| NOOK-047 | 3 | announcement precedes private export | none | none |
| NOOK-047 | 4 | populated workspace private content | `tests/readable-export.test.mjs:139` | asserted |
| NOOK-047 | 4 | workspace DMs | none | none |
| NOOK-047 | 4 | policy version on export | `tests/readable-export.test.mjs:137` | asserted |
| NOOK-047 | 4 | disable policy blocks retrieval | none | none |
| NOOK-047 | 4 | ownership loss blocks retrieval | none | none |
| NOOK-047 | 5 | ordinary admin cannot export another DM | none | none |
| NOOK-047 | 6 | held copies excluded | none | none |
| NOOK-047 | 6 | hold exclusion named | none | none |
| NOOK-047 | 6 | hold inventory absent | none | none |
| NOOK-047 | 7 | unknown old membership direction | none | none |
| NOOK-047 | 7 | unknown old membership time | none | none |
| NOOK-047 | 7 | new join direction and time | none | none |
| NOOK-047 | 7 | new leave direction and time | none | none |
| NOOK-047 | 8 | offline HTML readable | none | none |
| NOOK-047 | 8 | JSON hash census | `tests/readable-export.test.mjs:36` | asserted |
| NOOK-047 | 8 | file hash census | `tests/readable-export.test.mjs:37` | asserted |
| NOOK-047 | 8 | cancel | none | none |
| NOOK-047 | 8 | resume large job | none | none |
| NOOK-047 | 8 | all omissions named | none | none |
| NOOK-051 | 1 | membership action in filtered audit | none | none |
| NOOK-051 | 1 | export action in audit | none | none |
| NOOK-051 | 1 | erasure action in audit | none | none |
| NOOK-051 | 1 | admin override in audit | none | none |
| NOOK-051 | 1 | posting-permission action in audit | `tests/audit-journey.mjs:45` | asserted |
| NOOK-051 | 1 | owner CSV export | none | none |
| NOOK-051 | 1 | admin JSON export | none | none |
| NOOK-051 | 2 | member denial | none | none |
| NOOK-051 | 2 | guest denial | none | none |
| NOOK-051 | 2 | erased-actor denial | none | none |
| NOOK-051 | 2 | anonymized attribution | `tests/audit-journey.mjs:35` | asserted |
| NOOK-051 | 2 | action facts survive archive restore | none | none |
| NOOK-051 | old 3 | interrupted export uncertain (shared duty BASE-AUDIT-001) | `CONTRACT.md` Shared duties | moved |
| NOOK-051 | old 3 | no false completion (shared duty BASE-AUDIT-001) | `CONTRACT.md` Shared duties | moved |
| NOOK-051 | 3 | digest-enable event | none | none |
| NOOK-051 | 3 | digest-disable event | none | none |
| NOOK-051 | 3 | body-free digest audit | none | none |
| NOOK-051 | 3 | same-batch digest audit | none | none |
| NOOK-053 | 1 | private note created | `tests/notes-journey.mjs:22` | asserted |
| NOOK-053 | 1 | checklist revised with history | `tests/notes-journey.mjs:24` | asserted |
| NOOK-053 | 1 | provider link stays separate | none | none |
| NOOK-053 | 1 | item proposed to another assignee | `tests/notes-journey.mjs:28` | asserted |
| NOOK-053 | 1 | exact acceptance | `tests/notes-journey.mjs:33` | asserted |
| NOOK-053 | 2 | removed member denied | none | none |
| NOOK-053 | 2 | note history export | none | none |
| NOOK-053 | 2 | note deletion | `tests/notes-journey.mjs:74` | asserted |
| NOOK-053 | 2 | held note custodian preservation | none | none |
| NOOK-053 | 2 | source permissions remain distinct | none | none |
| NOOK-053 | 2 | source authority remains distinct | none | none |
| NOOK-065 | 1 | 120-member fixture | `tests/broadcast.mjs:19` | asserted |
| NOOK-065 | 1 | channel Attention census | `tests/broadcast.mjs:38` | asserted |
| NOOK-065 | 1 | channel push census | none | none |
| NOOK-065 | 1 | channel email census | `tests/broadcast.mjs:38` | asserted |
| NOOK-065 | 1 | sender absent | `tests/broadcast.mjs:36` | asserted |
| NOOK-065 | 1 | muted recipients absent | `tests/broadcast.mjs:36` | asserted |
| NOOK-065 | 1 | ignore-broadcast recipients absent | `tests/broadcast.mjs:36` | asserted |
| NOOK-065 | 1 | quiet recipients deferred | none | none |
| NOOK-065 | 1 | 119-minus-exclusions count | `tests/broadcast.mjs:36` | asserted |
| NOOK-065 | 1 | 30 fresh here recipients | `tests/broadcast.mjs:58` | asserted |
| NOOK-065 | 1 | everyone all active non-guests | `tests/broadcast.mjs:69` | asserted |
| NOOK-065 | 1 | everyone outside default channel refused | none | none |
| NOOK-065 | 2 | missing-confirmation conflict | none | none |
| NOOK-065 | 2 | missing-confirmation writes no message | `tests/broadcast.mjs:33` | asserted |
| NOOK-065 | 2 | confirmed one send | none | none |
| NOOK-065 | 3 | owners-only member refused | none | none |
| NOOK-065 | 3 | unpermitted webhook refused | none | none |
| NOOK-065 | 3 | refusal writes no message | none | none |
| NOOK-066 | 1 | owners-only root policy | none | none |
| NOOK-066 | 1 | replies-off policy | none | none |
| NOOK-066 | 2 | member root refused | none | none |
| NOOK-066 | 2 | member reply refused | none | none |
| NOOK-066 | 2 | notification reply refused | none | none |
| NOOK-066 | 2 | Slack webhook refused | none | none |
| NOOK-066 | 2 | Zapier action refused | none | none |
| NOOK-066 | 2 | workflow post refused | none | none |
| NOOK-066 | 2 | earlier schedule visibly fails | none | none |
| NOOK-066 | 2 | read still permitted | none | none |
| NOOK-066 | 2 | reaction still permitted | none | none |
| NOOK-066 | 2 | save still permitted | none | none |
| NOOK-066 | 3 | owner post | none | none |
| NOOK-066 | 3 | labeled admin override | `tests/posting.mjs:31` | asserted |
| NOOK-066 | 3 | override audit row | none | none |
| NOOK-066 | 4 | open reply succeeds | none | none |
| NOOK-067 | 1 | public forward note to DM at both widths | none | none |
| NOOK-067 | 1 | original author | none | none |
| NOOK-067 | 1 | original source | none | none |
| NOOK-067 | 1 | note | none | none |
| NOOK-067 | 1 | link-only attribution | none | none |
| NOOK-067 | 1 | link-only body absent | none | none |
| NOOK-067 | 1 | link-only attachment absent | none | none |
| NOOK-067 | 1 | link-only excerpt absent | none | none |
| NOOK-067 | 1 | link-only thread absent | none | none |
| NOOK-067 | 1 | link refuses unauthorized reader | none | none |
| NOOK-067 | 1 | show-message disclosure preview | none | none |
| NOOK-067 | 1 | show-message audit | none | none |
| NOOK-067 | 1 | owner link-only refuses disclosure | none | none |
| NOOK-067 | 1 | source deletion tombstones each copy | none | none |
| NOOK-067 | 2 | channel destination | none | none |
| NOOK-067 | 2 | fixed DM destination | none | none |
| NOOK-067 | 2 | group-DM destination | none | none |
| NOOK-067 | 2 | multiple destinations | none | none |
| NOOK-067 | 2 | thread destination | none | none |
| NOOK-067 | 2 | current destination posting permission | none | none |
| NOOK-067 | 3 | public body visible | none | none |
| NOOK-067 | 3 | explicit link-only body absent | none | none |
| NOOK-067 | 3 | explicit link-only files absent | none | none |
| NOOK-067 | 4 | fresh audience-bound disclosure | none | none |
| NOOK-067 | 4 | body-free disclosure audit | none | none |
| NOOK-067 | 4 | owner link-only before copying | none | none |
| NOOK-067 | 4 | owner block before copying | none | none |
| NOOK-067 | 5 | source edit propagates | none | none |
| NOOK-067 | 5 | source delete tombstones descendants | none | none |
| NOOK-067 | 5 | import undo tombstones descendants | none | none |
| NOOK-067 | 5 | author erasure tombstones descendants | none | none |
| NOOK-067 | 5 | cloned bytes erased | none | none |
| NOOK-067 | 5 | hold only preserves custodian copy | none | none |
| NOOK-071 | 1 | three threads across two channels and DM | none | none |
| NOOK-071 | 1 | unread counts at both widths | none | none |
| NOOK-071 | 1 | inline reply | none | none |
| NOOK-071 | 1 | mark-read cross-session | none | none |
| NOOK-071 | 1 | revoked thread removed | none | none |
| NOOK-071 | 2 | authored thread listed | none | none |
| NOOK-071 | 2 | replied thread listed | none | none |
| NOOK-071 | 2 | mentioned thread listed | none | none |
| NOOK-071 | 2 | unfollowed thread removed | none | none |
| NOOK-121 | 1 | three unread conversations | none | none |
| NOOK-121 | 1 | sidebar order | none | none |
| NOOK-121 | 1 | mark-one-read removes conversation | none | none |
| NOOK-121 | 1 | cross-session read | none | none |
| NOOK-121 | 1 | mark-all clears remaining | none | none |
| NOOK-121 | 1 | ten-second undo restores unread | none | none |
| NOOK-121 | 1 | Attention unchanged | none | none |
| NOOK-122 | 1 | three-person conversion | none | none |
| NOOK-122 | 1 | exact channel membership | none | none |
| NOOK-122 | 1 | full original history | none | none |
| NOOK-122 | 1 | complete original roster read-only | none | none |
| NOOK-122 | 1 | old DM read-only | none | none |
| NOOK-122 | 1 | old DM links channel | none | none |
| NOOK-122 | 1 | outsider cannot discover either | none | none |
| NOOK-122 | 1 | conversion audit | none | none |
| NOOK-122 | 2 | former participant kept in roster | `tests/group-conversion.mjs:15` | asserted |
| NOOK-122 | 2 | former participant excluded from membership | `tests/group-conversion.mjs:17` | asserted |
| NOOK-122 | 2 | creator-removal case | none | none |
| NOOK-122 | 2 | converter manages channel | `tests/group-conversion.mjs:12` | asserted |
| NOOK-122 | 3 | reactivation grants no private history | none | none |
| NOOK-122 | 3 | explicit regrant enables history | `tests/group-conversion.mjs:32` | asserted |
| NOOK-122 | 4 | pre-regrant archive roster | none | none |
| NOOK-122 | 4 | pre-regrant archive membership | none | none |
| NOOK-122 | 4 | pre-regrant archive refusal | none | none |
| NOOK-122 | 4 | post-regrant archive roster | none | none |
| NOOK-122 | 4 | post-regrant archive membership | none | none |
| NOOK-122 | 4 | post-regrant archive access | none | none |
| NOOK-122 | 4 | restart retains boundary | none | none |
| NOOK-072 | 1 | phone alert once | none | none |
| NOOK-072 | 1 | desktop app alert once | none | none |
| NOOK-072 | 1 | Threads row unread count | none | none |
| NOOK-072 | 1 | authored source on follow | `tests/threads.mjs:37` | asserted |
| NOOK-072 | 2 | later reply alerts author | none | none |
| NOOK-072 | 2 | later reply alerts prior replier | none | none |
| NOOK-072 | 3 | mention creates follow | `tests/threads.mjs:42` | asserted |
| NOOK-072 | 3 | later reply alerts mentioned member | none | none |
| NOOK-072 | 4 | unfollow suppresses next reply | none | none |
| NOOK-072 | 4 | later mention alerts once | none | none |
| NOOK-072 | 4 | later plain reply stays suppressed | none | none |
| NOOK-072 | 4 | own reply re-follows | `tests/threads.mjs:50` | asserted |
| NOOK-072 | 4 | subsequent reply alerts | none | none |
| NOOK-072 | 5 | one-to-one DM other participant alerts | none | none |
| NOOK-072 | 6 | removed member no alert | none | none |
| NOOK-072 | 6 | removed member no Threads row | none | none |
| NOOK-072 | 6 | import creates no follows | none | none |
| NOOK-072 | 6 | import creates no alerts | none | none |
| NOOK-072 | 6 | first native reply follows | none | none |
| NOOK-123 | 1 | untouched all-thread reply alerts | none | none |
| NOOK-123 | 1 | untouched thread listed | `tests/thread-delivery.mjs:43` | asserted |
| NOOK-123 | 1 | exception list names conversation | `tests/thread-delivery.mjs:44` | asserted |
| NOOK-123 | 2 | untouched root preference ID | none | none |
| NOOK-123 | 2 | follow object message ID | none | none |
| NOOK-123 | 2 | follow source all | none | none |
| NOOK-123 | 2 | Threads source all | `tests/threads.mjs:74` | asserted |
| NOOK-123 | 2 | existing stored source unchanged | none | none |
| NOOK-123 | 3 | mobile-only all thread follows | `tests/thread-delivery.mjs:43` | asserted |
| NOOK-123 | 3 | unfollow removes preference entry | none | none |
| NOOK-123 | 3 | unfollow removes Threads entry | none | none |
| NOOK-124 | 1 | phone badge unchanged | none | none |
| NOOK-124 | 1 | desktop badge unchanged | none | none |
| NOOK-124 | 1 | reply remains in Threads | `tests/thread-delivery.mjs:30` | asserted |
| NOOK-079 | 1 | owner creates and copies once at both widths | none | none |
| NOOK-079 | 1 | retry has one message | `tests/integration-tokens.mjs:29` | asserted |
| NOOK-079 | 1 | truthful via label | `tests/integration-tokens.mjs:26` | asserted |
| NOOK-079 | 2 | other channel refused | none | none |
| NOOK-079 | 2 | other route refused | none | none |
| NOOK-079 | 2 | service token cannot convey agent authority | none | none |
| NOOK-079 | 3 | rotated secret refused | none | none |
| NOOK-079 | 3 | replacement replays same key | `tests/integration-tokens.mjs:52` | asserted |
| NOOK-079 | 3 | revoked secret refused | none | none |
| NOOK-079 | 4 | every action/refusal shown | none | none |
| NOOK-079 | 4 | sealed hash only | `tests/integration-tokens.mjs:22` | asserted |
| NOOK-079 | 4 | restored activity retained | none | none |
| NOOK-079 | 4 | restored token absent | none | none |
| NOOK-082 | 1 | one due forward | `tests/scheduled-forwards.mjs:32` | asserted |
| NOOK-082 | 1 | optional note absent | `tests/scheduled-forwards.mjs:32` | asserted |
| NOOK-082 | 1 | optional note present | none | none |
| NOOK-082 | 1 | edit pending time | none | none |
| NOOK-082 | 1 | cancel pending time | none | none |
| NOOK-082 | 2 | approving session rechecked | none | none |
| NOOK-082 | 2 | access generation rechecked | `tests/scheduled-forwards.mjs:75` | asserted |
| NOOK-082 | 2 | source rechecked | `tests/scheduled-forwards.mjs:35` | asserted |
| NOOK-082 | 2 | owner policy rechecked | `tests/scheduled-forwards.mjs:67` | asserted |
| NOOK-082 | 2 | each destination posting checked | none | none |
| NOOK-082 | 2 | refused destination no send | `tests/scheduled-forwards.mjs:59` | asserted |
| NOOK-082 | 2 | each refusal reason visible | `tests/scheduled-forwards.mjs:72` | asserted |
| NOOK-082 | 2 | authorized subset commits atomically | none | none |
| NOOK-082 | 3 | no silent disclosure downgrade | none | none |
| NOOK-082 | 3 | restore pauses schedule | none | none |
| NOOK-082 | 3 | restored approving authority absent | none | none |
| NOOK-082 | 4 | pending source body absent | none | none |
| NOOK-082 | 4 | pending file snapshot absent | none | none |
| NOOK-082 | 4 | source erasure strips request | none | none |
| NOOK-082 | 4 | sender erasure removes request | none | none |
| NOOK-089 | 1 | approved-channel thread post | `tests/notification-extension.mjs:16` | asserted |
| NOOK-089 | 1 | lost-reply receipt lookup | none | none |
| NOOK-089 | 1 | one accepted receipt | `tests/notification-extension.mjs:21` | asserted |
| NOOK-089 | 1 | no second post | `tests/notification-extension.mjs:24` | asserted |
| NOOK-089 | 2 | replacement approval edits earlier post | `tests/notification-extension.mjs:34` | asserted |
| NOOK-089 | 2 | other app refused | none | none |
| NOOK-089 | 3 | immutable app-name/channel identity | none | none |
| NOOK-089 | 3 | other pair refused | none | none |
| NOOK-089 | 3 | revoked token refused | none | none |
| NOOK-089 | 3 | withdrawn channel authority refused | none | none |
| NOOK-089 | 4 | edit attributed to app in audit | none | none |
| NOOK-089 | 5 | original body-free receipt | `tests/notification-extension.mjs:35` | asserted |
| NOOK-089 | 5 | explicit non-acceptance | none | none |
| NOOK-089 | 5 | explicit tombstone | `tests/notification-extension.mjs:52` | asserted |
| NOOK-089 | 5 | no duplicate effect | `tests/notification-extension.mjs:24` | asserted |
| NOOK-035 | old 2 | Provider network-edge substitution is a reproducible proof boundary in the mechanism notes. | `docs/contract/mechanism.md` | moved |
| NOOK-035 | old 8 | A live-provider receipt is in the Field proof register. | `docs/contract/mechanism.md` | moved |
| NOOK-051 | old 4 | Future app/agent/workflow linkage is a requirement and inherited proof pointer. | `CONTRACT.md` | moved |
| NOOK-082 | old 3 | Native-client implementation is a separate capability; responsive-web widths remain the local forward proof. | `docs/contract/mechanism.md` | moved |
| NOOK-082 | old 4 | External forwarding is a pointer to NOOK-083 and NOOK-031. | `docs/contract/mechanism.md` | moved |
| NOOK-089 | old 4 | No-new-durable-category and migration statements describe mechanism, not a user outcome. | `docs/contract/mechanism.md` | moved |
| NOOK-044 | old 1 | Live Campfire account receipt moved to R-8; genuine upstream fixture migration still gates. | `CONTRACT.md` | moved |
| NOOK-046 | old 1 | Live Mattermost account receipt moved to R-8; genuine upstream fixture migration still gates. | `CONTRACT.md` | moved |
| NOOK-136 | 1 | draft survives navigation and restart | none | none |
| NOOK-137 | 1 | channel and DM sections organized | none | none |
| NOOK-137 | 1 | work acceptance unchanged | none | none |
| NOOK-007 | 1 | no ambient code or client-side/credentialed fetch from conversation/import/model content | none | none |
| NOOK-007 | 1 | provider effects use the scoped app/specialist/meeting door | none | none |
