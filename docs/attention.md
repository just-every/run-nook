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

Nothing else is emailed: not followed threads or conversations, reactions, replies that do not mention you, accepted or cancelled commitments, or imported history. Quiet time holds email until it ends. You get at most one email per conversation every ten minutes; later updates are counted in the next one. Nook does not email you about something you already read or dismissed, about a conversation you can no longer open, or after the message was deleted.

Email goes to the address you sign in with. It says who did what and where, with a link; it never contains message text or file names. Every email has a **Turn these emails off** link that works without signing in, and a link to your settings.

If an email cannot be sent, your settings say **Email not delivered** with the reason, and so do the settings of the person whose message it was and the workspace owner's. Nook tries again for a few hours first. A mail service accepting an email does not prove it reached the inbox.

An urgent request is a request inside Nook, not a page. Web Push follows your choices and quiet time; text messages and native mobile push are unavailable.

## Install and keep notifications current

Use **You → Install Nook** when your browser offers it, or install from the browser menu. On iPhone or iPad, use Share → Add to Home Screen, open Nook from there, then enable push. Notifications require a compatible browser and permission. Reopen Nook to reconcile a subscription removed by the browser; a visible error gives you a way to enable again without repeated permission prompts.

Push waits while a Nook page is visibly active and has a fresh heartbeat. Hidden or suspended pages do not suppress delivery indefinitely. Opening Nook synchronizes read notifications and badges. Sleeping devices may keep old notifications until opened; no silent background clear is sent.

## Keep up with threads

Open **Threads** to see discussions you started, replied to, were mentioned in or explicitly followed. Both people in a one-to-one DM follow its threads automatically. Imported history creates no follows; replying to an imported thread starts following it.

Reply inline or open the full discussion. **Mark thread read** clears that thread’s unread replies on your other sessions without closing Attention or reading another thread. **Unfollow thread** stays in effect after later mentions; replying yourself follows it again. A muted conversation appears here only for threads you explicitly follow. Removing channel access removes its threads at the next refresh.

## Personal and channel reminders

Open **Reminders** in the sidebar or **You → Reminders** on a phone. You can also type `/remind` in a conversation, choose **Remind me** from a message’s menu, or **Remind me about file** beside a file.

Enter a target, text and time, then choose **Preview reminder**. For example:

- `/remind me in 20 minutes to call Ana`
- `/remind #standup "Post your update" every weekday at 9am`
- `/remind me tomorrow at 9am to send the deck`

Choose your IANA time zone and confirm the displayed audience, date and recurrence. Date-only phrases use 9am. Unknown phrases save nothing. Recurrence keeps its declared local clock across daylight saving; monthly reminders skip months without their chosen day.

Personal reminders appear in Attention when due; quiet time holds them. Channel reminders post to current members and can be inspected by those members before delivery. Reminding another person requires a current channel-management role and their current membership. Reminders persist without an open page. Removed access, unavailable sources or posting restrictions produce a visible failure. A channel reminder more than 15 minutes late is held for review rather than posted after an outage.

Edit, snooze for 20 minutes, complete or cancel from Reminders. Completing a reminder changes no commitment or message read state. Sources are links, with no captured message body or file bytes. Restored pending reminders are paused; edit and confirm a future time before they resume.
