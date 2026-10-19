import { Buffer } from 'buffer';

// Shared readers use Buffer's binary methods; they never need fs or process.
const runtime = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof runtime.Buffer === 'undefined') runtime.Buffer = Buffer;
