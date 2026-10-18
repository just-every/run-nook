# Conversations

Channels and direct conversations keep messages, replies, reactions and files together. Every read and write checks the person's current session and current conversation access.

## Channels and direct conversations

Public channels can be browsed and joined by workspace members. Private channels are limited to their current members. Direct conversations have fixed participants. Use **New message → Start a group message** to choose two or more teammates; only the selected people and you can read it. Owners and admins do not gain access to a direct conversation they are not part of.

## Finding your way around

The conversation is the page. The left rail lists **Attention**, **Threads**, **Saved**, **Channels**, **Search** and your conversations, and your profile sits at its foot. Hover over a **Channels** or **Direct messages** heading to reveal the **+** that creates a channel or starts a message. The header holds the conversation name, a **Decisions** button that opens the [Decisions and requests panel](decisions-and-commitments.md) beside the messages, the member avatars (choose them for **Details**, where members are added or removed) and a **Conversation options** menu to follow or mute the conversation or open its pinned messages. On a phone the same pieces appear on full screens, with Attention, Threads, Channels, Search and You in a bar along the bottom.

## Threads, reactions and messages

Hover over a message, or tap it on a phone, to show its actions: add a reaction, open the thread, ask someone, record a decision, and **More**. Reply in a thread to keep the replies with their root. Reactions appear under the message as counts; choose a count to add or remove yours, or use **Add reaction** for another emoji. Authors can edit or delete their own messages from **More**; deletion leaves an empty tombstone in the conversation history. Messages from the same person in quick succession are grouped under one name.

The message box is a single line that grows as you write. Press Enter to send and Shift+Enter for a new line. Choose the paperclip to attach files, or **@** to notify a person or mark a message urgent with a reason.

## Files and search

Each message can have up to five files. A file can be 1 byte to 25 MiB and must be UTF-8 plain text, PNG, JPEG or PDF with a matching file signature. Files are private downloads available to current conversation members. PNG and JPEG images can also appear inline after their bytes pass image validation. Previews use the same current conversation access checks as downloads; text and PDF files remain downloads. File validation is not virus scanning.

Search matches case-insensitive text in conversations the person can read. Terms of any length work, including Q3 and HR. Filter by conversation, person and UTC date, or type `from:me`, `in:#channel`, `has:file`, `has:pin`, `is:saved`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD` or `on:YYYY-MM-DD`. Active typed filters are removable chips. Unknown modifiers are searched literally with a hint. Quoted text is an exact substring; token, prefix, exclusion and file-content search are not available. Use **Load more search results** to continue, including through an empty intermediate page for a short term. Results show native/imported source, author and time and open the surrounding conversation.

## Manage or leave a channel

Open **Details** to change a channel’s name or topic, transfer management to a current full member, or archive and restore it. The manager and current channel members who are workspace owners or admins can manage the channel. Workspace roles never open a private channel by themselves.

Archiving keeps history available and stops new posts, replies, edits, reactions, uploads. Public archived channels remain available in Browse public channels with **Join history**; joining never restores posting. Existing requests can still be resolved, and messages can still be erased. Restore from Details to resume posting.

**Leave channel** removes the channel from your navigation and stops pending notifications. Your messages and personal follow/read choices stay. Public channels can be rejoined from Browse public channels; private channels require a manager to add you again. A private manager transfers management before leaving. You may leave an archived public channel even when nobody else remains. An owner or admin can join its history and restore it from Details. Owners can make an organization-wide default channel mandatory under Team → Default channels; remove that requirement before leaving.

## Saved context and pins

Choose **More → Save for later** on a message or **Save file** on an attachment. **Saved** is a private, ordered list, available in the desktop rail and under **You** on a phone. You can also save an HTTP or HTTPS link associated with a conversation; Nook does not fetch it. Saves survive sign-in on another device and duplicate saves retain their original order. Choose **Remind me** on a saved item to pick a future date and time in the time zone shown. Edit or cancel it from Saved. When due, it appears privately in **Attention**, where you can dismiss it or snooze it for an hour; quiet time holds it. Reminders survive restart and never change unread messages or accepted work. If the source is erased or you lose access before it is due, the reminder is cancelled.

Channel members can choose **More → Pin to channel** and retrieve shared context from **Conversation options → Pinned messages**, with who pinned it and when. Direct conversations do not have shared pins. Archived channels keep pins readable but cannot change them.

Every list reload checks current access and source availability. Losing membership or erasing a source removes its excerpt and leaves an unavailable item; no saved body copy is kept. You can remove your own unavailable save. Pin and save links open their original context under the same access checks.

## All unreads and group conversations

Open **All unreads** in the sidebar, or from **You** on a phone, to catch up in sidebar order. Reading the list leaves messages unread until you open their conversation or choose **Mark conversation read** or **Mark all read**. Undo is available for ten seconds. A later read from another session wins over undo; Attention and accepted work are unchanged. Ctrl Shift A (Command Shift A on a Mac) opens the view; Shift Escape marks all read. You can hide its sidebar entry under You.

In a group DM’s **Details**, choose a private channel name and **Convert to private channel**. Its full history and original participants move together, with the same message, thread and file IDs. The fixed DM becomes read-only with a link to the channel. Only an original participant may convert it, and every original participant must still have access; restore missing access explicitly before converting. Later invitations follow normal private-channel permissions and disclose full history.

## Scheduled messages

Write in a conversation or thread, attach files and choose **Schedule for later**. For a new text message, use **Conversation options → Schedule message**. Review the owner, current audience, files and first send times. Choose a named time zone and either a one-off time or a daily, weekday, weekly or monthly recurrence with an end date. Times may be scheduled up to a year ahead; a series may run for up to a year after its first occurrence.

Open **Scheduled** in the sidebar or **You → Scheduled messages** on a phone. Inspect pending messages and occurrence history, change future text or times, remove future attachments, pause, review and resume, or cancel. A message already sent stays in its conversation. File templates stay private until sent and each occurrence receives an independent copy. Deleting a sent copy does not change future sends. Erasing an original template stops the schedule and names the missing file as the reason to review it. Cancel a draft dialog to change its attachments in the conversation composer.

The scheduler runs without an open browser and checks the sender’s current identity, membership, thread, mentions and posting permission again when due. A failed or unconfirmed send is visible with its reason; it is never automatically reposted. **Check scheduler** retries arming the durable scheduler without creating a second occurrence. More than 15 minutes late after an outage is held for review: choose a new future time before resuming. Restored archives pause active schedules for the same review.

Recurrence keeps the chosen local wall-clock time across daylight saving. A missing hour advances by the transition gap; a repeated hour uses its first occurrence once. Monthly prompts skip months without the requested day. End dates include that day in the schedule’s time zone.

## Drafts & sent

Open **Drafts & sent** in the sidebar, or under **You** on a phone. **Drafts** lists unsent messages saved in this browser for your account, including thread replies and unconfirmed sends. Continue a draft to reopen its conversation or thread; retrying an unconfirmed send retains its original intent. Browser drafts do not sync to another device.

**Scheduled** contains the same edit, pause, cancel and history controls as Scheduled messages. **Sent** lists messages you sent in the last 30 days, newest first, with pages of older messages and a link back to each message. It shows current revisions and excludes deleted messages and conversations you can no longer read. Imported history is not a sent message.

## Files

Choose **Files** in a conversation’s Messages/Files tabs to browse its shared files, newest first, or open **Files** from the sidebar or **You** to browse all conversations you can read. Filter by person or file type, download the original bytes, preview supported PNG/JPEG images, or open a file’s original message/thread. Native files and published imported files appear together, with their original author and shared time. Staged uploads and deleted files do not appear; losing conversation access removes its files. File contents are not searched.
