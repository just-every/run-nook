/** Exact parsed JSON is retained for private source custody, including previous
 * bodies. Do not persist this object as an erased/live message projection. */
export type SlackSourceRecord = Record<string, unknown>;
export { captureSlackDeltaArchive } from './capture.mjs';
export interface SlackDeltaEntryContext {
    namespace: string;
    channel: string;
    archiveDigest: string;
    entryPath: string;
}
export interface SlackDeltaProvenance extends SlackDeltaEntryContext {
    recordIndex: number;
}
export interface SlackDeltaBase {
    namespace: string;
    channel: string;
    sourceRecord: SlackSourceRecord;
    provenance: SlackDeltaProvenance;
}
export interface SlackDeltaIdentity extends SlackDeltaBase {
    key: string;
    /** Original exact Slack ts (original_ts on mutation logs). */
    sourceTimestamp: string;
    /** Top-level record ts; mutation time for mutation logs. */
    eventTimestamp: string;
}
export interface SlackDeltaMessage extends SlackDeltaIdentity {
    kind: 'snapshot' | 'edit';
    sourceActor: string;
    body: string;
    editedAt: string | null;
    editorId: string | null;
    /** Supplied thread-root identity. null means none supplied; an edit without
     * thread_ts does not establish that an existing message left its thread. */
    threadRoot: string | null;
    latestReplyTimestamp: string | null;
    /** null means not supplied. Slack may omit reactors from users even when
     * count is accurate; this is not a complete roster of source actors. */
    reactions: { name: string; count: number; users: string[] }[] | null;
    pinnedTo: string[] | null;
    /** null means no file metadata supplied, distinct from an explicit []. */
    files: SlackSourceRecord[] | null;
}
export interface SlackDeltaDeletion extends SlackDeltaIdentity {
    kind: 'deletion';
    editorId: string;
}
export interface SlackDeltaSystem extends SlackDeltaBase {
    kind: 'system';
    subtype: string;
}
export interface SlackDeltaUnsupported extends SlackDeltaBase {
    kind: 'unsupported';
    reason: 'unsupported-record-type' | 'unsupported-message-subtype';
}
export type SlackDeltaRecord = SlackDeltaMessage | SlackDeltaDeletion | SlackDeltaSystem | SlackDeltaUnsupported;
export function normalizeSlackDeltaRecord(record: unknown, context: SlackDeltaProvenance): SlackDeltaRecord;
export function normalizeSlackDeltaRecords(records: unknown, context: SlackDeltaEntryContext): SlackDeltaRecord[];

export interface SlackZipConversationCoverage {
    channel: string;
    status: 'unverified';
    completeness: 'unknown';
    sourceAuthenticityVerified: false;
    reason: 'zip-does-not-prove-complete-source-range';
    /** Prior trusted frontier from caller state, in exact Slack ts format.
     * This function does not establish or advance it. */
    lastVerifiedAt: string | null;
    /** Observed bounds are never verified coverage bounds. */
    observedFirstTimestamp: string | null;
    observedThroughTimestamp: string | null;
    /** Counts are supplied records, not deduplicated apply effects. */
    snapshots: number;
    edits: number;
    deletionMarkers: number;
    replies: number;
    reactionSnapshots: number;
    systemRecords: number;
    unsupportedRecords: number;
    observedEntries: string[];
    /** Positive deletion markers only; never missing-source inferences. */
    explicitDeletionKeys: string[];
}
export function analyzeSlackZipCoverage(input: {
    namespace: string;
    records: SlackDeltaRecord[];
    conversations?: { channel: string; lastVerifiedAt?: string | null }[];
}): {
    namespace: string;
    completeness: 'unknown';
    sourceAuthenticityVerified: false;
    conversations: SlackZipConversationCoverage[];
};
