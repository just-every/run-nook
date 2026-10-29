# Attention

Attention collects updates that match each person's choices and requests made directly to them.

## Choose what reaches you

Follow a conversation to receive its routine updates. Mute a conversation to pause those routine updates. Follow a thread to receive replies to that thread. Quiet time defers ordinary attention until it ends.

An urgent request goes to explicitly selected conversation members and needs a reason. It remains visible during quiet time. A mention can also create an attention item.

Every current channel member can see the message's **Notified** names, **Urgent** marker and urgent reason, including people who were not notified. These details explain the request to the channel; they are not private to its recipients.

## Manage an attention item

Attention is a flat list of what needs you, each item with the conversation and the reason it reached you. Hover over an item (they are always shown on a phone) and choose **Dismiss** to clear it from your open list, or **Remind me in an hour** to snooze it for one hour. **Quiet for one hour** at the top of the page starts quiet time; **End quiet time** stops it. Nook records these states as done and snoozed. These actions change attention only; dismissing an item does not accept or complete a commitment.

In **You**, enable push on this device to receive alerts while away. Choose mentions and commitments, urgent requests, direct messages and replies to threads you follow separately. Email has its own controls. Push permission is requested only when you press Enable.

## Email when you are away

On a hosted workspace with mail configured, Nook can email you when you are away from the browser. Local development sends and stores no email. Email is off until you turn it on under **Your profile → Email me when…**:

- **Someone mentions me or asks me to take on a commitment** covers explicit mentions, a commitment proposed to you or changed after you were asked, and a report that a commitment you asked for is complete.
- **Someone sends me an urgent request** covers urgent requests. Quiet time holds them like everything else unless you also tick **Let urgent requests through quiet time**.

The separate **Mentions and DMs while I’m away** choice also emails direct messages, bundled across conversations every 15 minutes or hourly. At most one away bundle is sent in the selected interval; it names a sender and conversation, includes a link to that update and a link to review all bundled updates, and contains no message text. Its first-sign-in offer says email is off and requires an explicit choice, unless the owner selected an email-on default for new members. Routine followed channel threads, reactions, accepted or canceled commitments and imported history are not emailed. Quiet time holds email until it ends. Every conversation keeps its ten-minute limit across these choices, including updates folded into an away bundle; later updates are counted in the next eligible email. Nook does not email you about something you already read or dismissed, about a conversation you can no longer open, or after the message was deleted.

Email goes to the address you sign in with. It says who did what and where, with a link; it never contains message text or file names. Every email has a **Turn these emails off** link that works without signing in, and a link to your settings.

If an email cannot be sent, your settings say **Email not delivered** with the reason, and so do the settings of the person whose message it was and the workspace owner's. Nook tries again for a few hours first. A mail service accepting an email does not prove it reached the inbox.

An urgent request is a request inside Nook, not a page. Web Push follows your choices and quiet time; text messages and native mobile push are unavailable.

## Install and keep notifications current

Use **You → Install Nook** when your browser offers it, or install from the browser menu. On iPhone or iPad, use Share → Add to Home Screen, open Nook from there, then enable push. Notifications require a compatible browser and permission. Reopen Nook to reconcile a subscription removed by the browser; a visible error gives you a way to enable again without repeated permission prompts.

Phone/tablet Web Push waits while you are active on desktop/web. Keyboard, pointer or focus input within ten minutes counts as activity, backed by a heartbeat that expires after 45 seconds. Desktop/web devices still alert, and Attention remains available in the active client. A hidden page releases its activity immediately; suspended pages expire. Web browsers cannot report OS lock state.

In **You → Your device delivery**, choose **Always send to mobile, even when I'm active**, or a delay after becoming inactive: immediately (the default), 1, 2, 5, 10, 15 or 30 minutes. The delay is an account choice. “Always send” is also offered for each registered phone or tablet (**Always send to this device**), so one phone can alert while you are active on desktop and another stays held; each device shows its routing, such as “Always send: this device” or “Phone held: active on …”. Only you can set or see your devices’ routing, and removing a device removes its choice. Urgent requests you allow through quiet time bypass this activity hold. Held events fold under the ten-minute conversation rule; reading or dismissing one on any device cancels its held phone alert as `held-active-elsewhere`, without claiming it was displayed or missed.

Only you can see your device delivery view. It shows activity, last input, unavailable web lock state, routing and, from the last seven days, up to the latest 100 alerts. Every Web Push alert held while you are active on desktop, waiting for your mobile delay, in quiet time or snoozed, and every release and cancellation, is kept with its reasons in your own readable export (`device_deliveries`) and in backups, so older records remain available there. Email entries in this view follow email's rules: problems are shown for seven days and email delivery rows are removed after thirty days. Native activity, OS lock state and delivery-bar measurements remain NOOK-021 obligations; call invites follow NOOK-022. Opening Nook synchronizes read notifications and badges. Sleeping devices may keep old notifications until opened; no silent background clear is sent.

## Keep up with threads

Open **Threads** to see discussions you started, replied to, were mentioned in or explicitly followed. Both people in a one-to-one DM follow its threads automatically. Imported history creates no follows; replying to an imported thread starts following it.

Reply inline or open the full discussion. **Mark thread read** clears that thread’s unread replies on your other sessions without closing Attention or reading another thread. **Unfollow thread** stays in effect after later mentions; replying yourself follows it again. A muted conversation appears here only for threads you explicitly follow. Removing channel access removes its threads at the next refresh.

## Personal and channel reminders

Open **Reminders** in the sidebar or **You → Reminders** on a phone. You can also type `/remind` in a conversation, choose **Remind me** from a message’s menu, or **Remind me about file** beside a file.

Write what and when, then choose **Preview reminder**. A reminder that names no one is for you; start with `@person` or `#channel` to remind someone else. For example:

- `Water the basil tomorrow at 9am`
- `/remind me in 20 minutes to call Ana`
- `/remind #standup "Post your update" every weekday at 9am`
- `/remind me tomorrow at 9am to send the deck`

Choose your IANA time zone and confirm the displayed audience, date and recurrence. Date-only phrases use 9am. Unknown phrases save nothing. Recurrence keeps its declared local clock across daylight saving; monthly reminders skip months without their chosen day.

Personal reminders appear in Attention when due; quiet time holds them. Channel reminders post to current members and can be inspected by those members before delivery. Reminding another person requires a current channel-management role and their current membership. Reminders persist without an open page. Removed access, unavailable sources or posting restrictions produce a visible failure. A channel reminder more than 15 minutes late is held for review rather than posted after an outage.

Edit, snooze for 20 minutes, complete or cancel from Reminders. Completing a reminder changes no commitment or message read state. Sources are links, with no captured message body or file bytes. Restored pending reminders are paused; edit and confirm a future time before they resume.

## Reach a channel together

Use `@channel` for current channel members, or `@here` for members with a foreground heartbeat in the last ten minutes who have not set themselves away in **You → Availability**. Nook confirms a broadcast reaching six or more people, showing the current count, quiet-time count and time-zone count. The committed message keeps its recipient list; retrying does not choose a new audience.

Owners set workspace broadcast policy in **Team**, and channel managers can choose an override in **Details → Channel broadcasts**. Policies allow everyone, owners/admins or named people. An owner can designate a mandatory public default channel for `@everyone`; saving the designation discloses and grants its full history to all active non-guest members. Later broadcasts never add members, and removing the mandatory default designation stops `@everyone` there.

Mute and **Ignore @channel, @here and @everyone** in a conversation’s notification settings suppress broadcasts. Quiet time defers them, with no urgent bypass. Email and Web Push each have their own broadcast choice in **You**, initially following the corresponding mention choice. A conversation set to Nothing sends no external alert. Ordinary message reads and work acceptance remain independent.

Scheduled messages and channel reminders show broadcast consent before saving. Membership, audience size, broadcast policy and posting permission are checked again at each occurrence. A changed policy produces a visible failed occurrence for review. User groups, app/webhook/workflow transports, native clients and real-device receipt remain outside the current evidence.

## Thread replies on your devices

You follow threads you start, reply to, or are mentioned in, including channel-wide mentions. Unfollow stays in effect after another mention; replying yourself follows again. In a conversation's **Notification settings**, choose all thread replies for desktop/web or override this for phones and tablets. An individual unfollow still wins. **You → Push notifications → This device** lets you correct its device class. Nothing silences alerts while explicit mentions remain in Attention.

**Count thread replies only when they mention me** changes unread and Web Push badge counts for your account, including other open sessions. It leaves ordinary replies in Threads and does not read them or silence their alerts. Newly enabling push turns on supported mentions, DMs and followed-thread replies once; later device registration preserves your explicit choices. Email is independent and stays off until you choose it.

A notification for a single thread offers **Unfollow thread** where browser actions are supported. The action requires the same signed-in recipient and current thread access; a refused action asks you to open Nook. A burst spanning several threads offers **Manage threads** so you can choose which to unfollow. Native apps, real device receipt, recurring quiet schedules remain separate acceptance gaps.

## Keywords

In **You → Keywords**, add words or phrases you want to hear about, up to 20 of up to 64 characters each. When someone else writes one in a conversation you can read, you get one **keyword** item in Attention, however many of your keywords the message contains. Matching ignores case and uses whole words (a phrase matches consecutive words), so `invoice` does not match `invoices`. You never get one for your own messages, for imported history, or in a conversation you muted unless you choose **Also notify me for keywords in muted conversations**; a conversation set to nothing stays silent. Push for keywords is on once you enable push on a device, and email is off until you choose **Email me for keyword matches**. Only you can see your list; it appears in your own readable export, travels in your operational backup like your other notification choices, and is removed if you are erased.

## Vacation and new-member defaults

In your notification settings in **You**, set **Vacation starts** and **Vacation ends**. Times use your device’s time zone. Vacation holds device and email alerts; your existing urgent-through-quiet choices determine whether an urgent request bypasses the hold. Attention explains a vacation hold and its end. **End vacation** releases eligible unread work without changing responsibility or ownership.

Owners set **New-member notifications** under **You → Settings**: push events, a level for each designated default channel, and whether away email starts on. The first sign-in applies that version once. Each member can change their own preferences afterward; later policy changes do not reset those choices. Policy changes and adoption retain audit facts. Delegated administration and group defaults are not available.
