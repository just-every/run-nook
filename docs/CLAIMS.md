# Implementation claims

| Clause | Status | Proven scope | Remaining scope |
| --- | --- | --- | --- |
| NOOK-033 | done | Web/API personal and channel reminders, parsed confirmation, durable current-authority delivery, independent triage and paused restore; `tests/reminders.mjs`, `tests/reminders-browser.mjs`, `tests/exit-export.test.mjs`. | Native clients are tracked separately by NOOK-021. |
| NOOK-065 | partial | Web/API broadcasts with saved audiences, confirmation, current-authority policy, quiet/ignore choices, email/encrypted push and durable scheduled/reminder sends; `tests/broadcast.mjs`, `tests/broadcast-browser.mjs`, `tests/push/broadcast.mjs`, `tests/notify/broadcast.mjs`. | User groups, app/webhook/workflow grants, native clients and real provider/device receipt. |
