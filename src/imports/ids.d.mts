export const MAPPING_VERSION: string;
export function nativeId(namespace: string, kind: string, key: string): string;
export function effectInputs(capture: any, owner: string, uploadId: string, reviewId: string): {
    domainJob: string;
    effects: any[];
};

export function captureJobId(capture: any, uploadId: string): string;

export function fileObjectKey(owner: string, upload: string, job: string, review: string, file: string): string;
