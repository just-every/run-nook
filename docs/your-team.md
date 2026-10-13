# Your team

Owners and admins manage team access. Members use their current channels; guests can use only explicitly granted channels.

## Roles and access

- **Owner:** manages the workspace and can invite owners, admins and members.
- **Admin:** manages member access and can invite members.
- **Member:** uses the channels they can access and can create conversations.
- **Guest:** has the member role with guest access mode and can use only selected channels.

An admin does not get extra access to another person's direct messages. New members see the full history of the channels you grant.

## Invitations

Owners and admins open **You → Team**. In **Invite someone**, leave **Action** on **Invite a teammate**, enter their name and email, choose their access type and role, then select the initial channels. The invitee confirms the one-time invitation link. In local development, that email appears in the local outbox at `/__dev/outbox`; production invitations use the mail provider configured by the owner.

## Deactivate or restore access

Choose **Deactivate** beside a teammate to disable their account and remove active workspace access. Reactivating an account does not restore channel access or an old session. To let the person back in, explicitly grant selected channels; they must use a fresh sign-in link.

Hover over a person under **People** (the actions are always shown on a phone) to deactivate, reactivate or erase them. The Team screen also lets an owner or admin remove a person's access to an individual channel. Channel access determines who can read its history and send messages.
