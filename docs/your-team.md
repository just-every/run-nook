# Your team

Owners and admins manage team access. Members use their current channels; guests can use only explicitly granted channels.

## Roles and access

- **Owner:** manages the workspace and can invite owners, admins and members.
- **Admin:** manages member access and can invite members.
- **Member:** uses the channels they can access and can create conversations.
- **Guest:** has the member role with guest access mode and can use only selected channels.

An admin does not get extra access to another person's direct messages. New members see the full history of the channels you grant.

## Invitations

On a hosted workspace, owners and admins open **You → Team**. In **Invite someone**, leave **Action** on **Invite a teammate**, enter their name and email, choose their access type and role, then select the initial channels. Nook sends the one-time invitation through the mail provider configured by the owner; the invitee confirms its link.

## Try a teammate locally

Open the `RER_OPEN` link as the owner, finish `/setup` and create a channel.
In **You → Team**, choose **Enter as local teammate**, or open
`/auth/dev/enter?as=member` in the same browser. This creates the independent
local account `member@dev.localhost`. Return through
`/auth/dev/enter?as=owner`, add the member using the channel's **Details** control,
then re-enter through `/auth/dev/enter?as=member` to use that channel.

The `admin` and `guest` personas are also available at the same route. Each fresh
browser must first open `RER_OPEN`. Local personas have fixed development
addresses and do not accept arbitrary email invitations. No local email is sent
or stored, and there is no local mail viewer.

## Deactivate or restore access

Choose **Deactivate** beside a teammate to disable their account and remove active workspace access. Reactivating an account does not restore channel access or an old session. To let the person back in, explicitly grant selected channels; on a hosted workspace they must use a fresh sign-in link. Locally, re-enter through the admitted browser's persona route.

Hover over a person under **People** (the actions are always shown on a phone) to deactivate, reactivate or erase them. The Team screen also lets an owner or admin remove a person's access to an individual channel. Channel access determines who can read its history and send messages.

## Switching workspaces

Each Nook installation is its own workspace with its own address. **Your workspaces** (in the sidebar, or under **You** on a phone) lists the installations this browser has signed in to. The list is kept on this device, not on any server.

- Choose a workspace to open it at its own address. Sign-in, drafts, caches and notifications stay separate for each one, so signing out of one leaves the others signed in.
- **Add a workspace** opens another installation by its address, such as `chat.example.com`.
- When you open a workspace from the menu, the list goes with you in the link's fragment, which is never sent to a server. A workspace that list has never held is added only after you choose **Add**.
- **Remove** forgets another workspace on this device. It does not sign you out there.

## Your quiet schedule

In **You → Your quiet schedule**, choose your time zone and enable quiet hours. Monday–Friday start at 22:00 and finish at 07:00 by default; change a day’s times or switch it off for an exception. An overnight rule starts on its named weekday, so Thursday’s quiet hours still run into Friday morning when Friday is switched off. Times stay at the declared local clock time across daylight saving changes. Your browser’s travel or time-zone setting does not silently move the schedule.

Email and Web Push wait in the existing delivery queue until quiet hours end, including after a restart. Urgent requests bypass quiet hours only under your separate email or push choice. **Snooze alerts for one hour** adds a temporary hold; ending that snooze keeps the recurring schedule. Quiet and item snoozes are limited to seven days. Attention and **Your device delivery** include an **Explain why** line; delivery to a provider is distinct from a notification observed on your device.
