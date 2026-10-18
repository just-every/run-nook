import type { SourceBundle, ImportMapping } from './kit';
export const MATTERMOST_MAPPING_VERSION: string;
export function mattermostNativeId(namespace: string, kind: string, key: string): string;
export function mattermostCaptureJobId(capture: any, upload: string): string;
export function assertMattermostFileSize(size: number): void;
export function assertMattermostEffect(kind: string, value: any): void;
export function mattermostEffectInputs(capture: any, owner: string, upload: string, review: string): { domainJob: string; effects: Array<{ kind: string; key: string; value: any }> };
export function mattermostMapping(): ImportMapping;
export function mattermostKitSource(capture: any, owner: string, upload: string, review: string): { source: SourceBundle; mapping: ImportMapping; domainJob: string };
