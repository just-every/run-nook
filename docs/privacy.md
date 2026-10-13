# Privacy and access

Nook checks the current sign-in session and current conversation membership for private reads and writes.

## Who can see a conversation

People can read a channel only while they are members. Direct conversations have fixed participants, and owner or admin status does not let someone read another person's direct messages. The Team screen shows workspace identities and channel access to authorized owners and admins.

## Where the data goes

Messages and product records are stored in D1; file bytes are stored in the private R2 bucket. A person who can read the installation's local storage or hosted D1 and R2 data can access that stored information. Application roles do not override that storage authority.

Nook has no AI feature or external notification integration. Sign-in and invitation email uses the provider configured by the workspace owner. Local development outbox mail remains in the local installation.
