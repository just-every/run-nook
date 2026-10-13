import type { ImportPlan } from './kit.ts';
export function validateReviewedPlan(read: (table: string) => Promise<any[]>, review: any, job: any, plan: ImportPlan): Promise<{plan: ImportPlan; summary: any; effects: Map<string, any>}>;
