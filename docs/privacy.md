# Privacy and access

Nook checks the current sign-in session and current conversation membership for private reads and writes.

## Who can see a conversation

People can read a channel only while they are members. Direct conversations have fixed participants, and owner or admin status does not let someone read another person's direct messages. The Team screen shows workspace identities and channel access to authorized owners and admins.

## The audit log

Owners and admins can read the audit log under **You → Team → Audit log**; in a workspace without an admin only the owner can. Members and guests cannot, and the server refuses them too. It records who changed sign-in, invitations, roles, membership, workspace policies, exports, erasure, integration tokens and channels, when, where and whether the change took effect, and it can be filtered and downloaded as CSV or JSON. It never contains message text, email addresses or secrets. A direct conversation appears only as "a direct conversation", and a private channel is named only to someone who belongs to it. Nobody can edit or delete an entry; erasing a person removes their name from it and keeps the record of what happened. The audit log is access-control history, not observability: for metrics, logs, traces and alerts, see RunEditRun's [Porthole](https://github.com/just-every/run-porthole).

## Where the data goes

Messages and product records are stored in D1; file bytes are stored in the private R2 bucket. A person who can read the installation's local storage or hosted D1 and R2 data can access that stored information. Application roles do not override that storage authority.

Nook has no AI feature. Sign-in, invitation and opted-in notification email uses the provider configured by the workspace owner. Local development sends and stores no email and has no mail viewer; local sign-in uses the checkout's private development session. Notification emails contain sender and conversation names and links, never message bodies, file names, urgent reasons or commitment wording.

## Push notifications

Push is off until you enable it in **You**. Your installation sends encrypted Web Push directly to your browser's Apple, Google or Mozilla push service. No RER relay is used. The encrypted payload includes the sender's name, channel name (or "a direct conversation"), opaque recipient and delivery IDs, a link to the authenticated conversation/message, a notification tag and badge count. It excludes message bodies, commitment wording, urgent reasons and file names. These displayed names may be visible on your lock screen according to your device settings.

The push service sees your subscription endpoint, timing, encrypted packet size, delivery TTL and priority, the installation's VAPID public key, and signed audience, expiry and owner contact URI. It cannot decrypt the payload using those fields. The installation stores the endpoint, browser public encryption key and subscription authentication secret in private D1, together with the owning account/session and registration times. Its VAPID private key is encrypted at rest using the instance session secret. An operator with D1 access can read subscription endpoints and browser keys, including the subscription authentication secret. Decrypting the separately sealed VAPID private key additionally requires the instance SESSION_SECRET.

Visible-page heartbeats contain only an opaque page/device ID, account/session and short expiry. Expired presence is removed by the delivery alarm. Devices are removed on sign-out/revocation, manual removal, session expiry or a push service's expired-subscription response. Delivery metadata contains opaque references and status, not message content; terminal rows are removed after thirty days, and problems are displayed for seven days. An inactive installation performs cleanup when its alarm next runs. Member, message and outcome erasure removes associated delivery records.

Archives exclude device subscriptions, presence, VAPID keys and delivery queues. A restored installation sends no old notifications and requires fresh device registration. Existing downloaded backups, push-service retention and already displayed notifications cannot be erased remotely by deleting a live database row.

Nook's service worker caches no private pages, messages or attachments. Each background push displays an alert; Nook never sends silent badge or notification-clear pushes. Opening Nook synchronizes read notifications and badges. A sleeping device can retain an old alert or badge until it next opens; native background clearing is not available.
