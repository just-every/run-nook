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
