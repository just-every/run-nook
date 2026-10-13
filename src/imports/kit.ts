// Actual Base asynchronous D1 implementation, vendored without modification.
export * from '../base/modules/import-kit/src/d1/index.ts';
// Nook's request budget narrows the kit's own per-request allowance.
export { remaining, reserveReturn } from '../base/modules/import-kit/src/d1/budget.ts';
