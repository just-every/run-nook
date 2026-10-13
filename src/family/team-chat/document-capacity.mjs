// D1 limits each string/blob/row to 2,000,000 bytes. Reserve room for SQLite's
// record header and the row's revision/schema columns before issuing any write.
// Raw-media quotas are separate; base64 and provenance count toward this bound.
export const MAX_DOCUMENT_BYTES=1_900_000
