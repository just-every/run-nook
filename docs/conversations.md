# Conversations

Channels and direct conversations keep messages, replies, reactions and files together. Every read and write checks the person's current session and current conversation access.

## Channels and direct conversations

Public channels can be browsed and joined by workspace members. Private channels are limited to their current members. Direct conversations have fixed participants. Owners and admins do not gain access to a direct conversation they are not part of.

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

Archiving keeps history available and stops new posts, replies, edits, reactions, uploads and joins. Existing requests can still be resolved, and messages can still be erased. Restore from Details to resume posting.

**Leave channel** removes the channel from your navigation and stops pending notifications. Your messages and personal follow/read choices stay. Public channels can be rejoined from Browse public channels; private channels require a manager to add you again. A private manager transfers management before leaving. Restore an archived public channel, or transfer its management to someone who can restore it, before leaving its last managerless audience. Mandatory/default-channel policy is not available yet.

## Saved context and pins

Choose **More → Save for later** on a message or **Save file** on an attachment. **Saved** is a private, ordered list, available in the desktop rail and under **You** on a phone. You can also save an HTTP or HTTPS link associated with a conversation; Nook does not fetch it. Saves survive sign-in on another device and duplicate saves retain their original order. Due reminders are not available yet.

Channel members can choose **More → Pin to channel** and retrieve shared context from **Conversation options → Pinned messages**, with who pinned it and when. Direct conversations do not have shared pins. Archived channels keep pins readable but cannot change them.

Every list reload checks current access and source availability. Losing membership or erasing a source removes its excerpt and leaves an unavailable item; no saved body copy is kept. You can remove your own unavailable save. Pin and save links open their original context under the same access checks.
