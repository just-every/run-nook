declare module 'pako' {
  export class Inflate {
    constructor(options: { raw: boolean; chunkSize: number });
    onData: (chunk: Uint8Array) => void;
    push(input: Uint8Array, finish: boolean): boolean;
    err: number;
    ended: boolean;
    strm: { total_in: number };
  }
}
