export type AttestedRange = { from: string; to: string };
export type RecordedAttestation = AttestedRange & {
    label: 'attested, not verified'; statedBy: string; statedByName: string; statedAt: string;
};
export const attestationLabel: 'attested, not verified';
export function attestedRange(value: unknown, now?: number): AttestedRange | undefined;
export function recordAttestation(range: AttestedRange, owner: {id: string; name: string}, at: number): RecordedAttestation;
export function validateStoredAttestation(value: unknown, binding: {owner: string; created: number}): void;
