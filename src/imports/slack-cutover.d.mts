export type CutoverRow = { sourceId: string; name: string; email: string; needsAddress: boolean; proposed: 'member' | 'guest'; adminFlag: 'workspace-owner' | 'workspace-admin' | null; channels: string[] };
export type Cutover = { rows: CutoverRow[]; counts: Record<string, number>; notListed: number };
export const cutoverRowLimit: number;
export function cutoverInvitations(input: { users: any[]; channels: any[]; automationIds: Set<string> }): Cutover;
export function validateCutover(value: unknown): void;
export function validateCutoverChoices(rows: CutoverRow[], choices: unknown): Record<string, 'admin'>;
