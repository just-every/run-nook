// One native row participates in two projections. Its immutable send intent is
// the only broadcast marker; edits, deletion and exports never copy a reply.
export const inChannel=(message='m')=>`(${message}.parent IS NULL OR EXISTS(SELECT 1 FROM nook_thread_broadcasts channel_reply WHERE channel_reply.message=${message}.id))`;
