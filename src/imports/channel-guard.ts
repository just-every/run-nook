/** Attachment origin survives imported-message erasure through its structural
 * message row. Native uploads never bind directly to immutable imported rows. */
export function importedAttachment(attachment: string) {
    return `EXISTS(SELECT 1 FROM nook_import_files f WHERE f.attachment=${attachment}.id AND f.message=${attachment}.message) OR EXISTS(SELECT 1 FROM nook_erased_import_messages m WHERE m.id=${attachment}.message AND m.conversation=${attachment}.conversation)`;
}

/** Logical erasure preserves native work and any explicitly retained body.
 * Anonymous event labels alone cannot prove that an import owns the channel. */
export function retainedChannelHistory(conversation: string) {
    return [
        `EXISTS(SELECT 1 FROM nook_message_history m WHERE m.conversation=${conversation})`,
        `EXISTS(SELECT 1 FROM nook_outcome_history o WHERE o.conversation=${conversation})`,
        `EXISTS(SELECT 1 FROM nook_attachment_history a WHERE a.conversation=${conversation} AND NOT (${importedAttachment('a')}))`,
        `EXISTS(SELECT 1 FROM nook_retained_import_bodies b JOIN nook_erased_import_messages m ON m.id=b.id WHERE m.conversation=${conversation})`
    ].join(' OR ');
}
