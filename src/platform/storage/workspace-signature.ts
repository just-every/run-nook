// Same opaque triage signature in the fresh document and the initial live
// hint: opening the socket needs another read only if something changed.
export const attentionSignature=`SELECT (SELECT count(*)||':'||total(COALESCE(snooze_until,0))||':'||total(state='open') FROM nook_attention WHERE user=?)||'|'||COALESCE((SELECT dnd_until FROM nook_settings WHERE user=?),'') AS v`
