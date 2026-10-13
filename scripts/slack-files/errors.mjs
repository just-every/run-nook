export class FileError extends Error {
    constructor(code) { super(code); this.code = code; }
}
export function fail(code) { throw new FileError(code); }
