import { Context } from '../platform/storage/context';

// D1 runs at most 1,000 statements per Worker invocation. Every import request
// counts each statement it runs at the binding, batch members included, and
// keeps to this budget: the kit's batches, Nook's own reads and writes, and the
// sign-in check before them. The remaining 100 are margin.
export const REQUEST_STATEMENTS = 900;
const meters = new WeakMap<object, { used: number }>();

export function metered(db: D1Database): D1Database {
    const meter = { used: 0 }, raw = new WeakMap<object, D1PreparedStatement>();
    const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
        const counted = (run: () => any) => { meter.used++; return run(); };
        const result = {
            bind: (...values: unknown[]) => wrap(statement.bind(...values)),
            first: (...args: any[]) => counted(() => (statement.first as any)(...args)),
            all: () => counted(() => statement.all()),
            run: () => counted(() => statement.run()),
            raw: (...args: any[]) => counted(() => (statement.raw as any)(...args))
        } as unknown as D1PreparedStatement;
        raw.set(result, statement);
        return result;
    };
    const database = {
        prepare: (sql: string) => wrap(db.prepare(sql)),
        batch: (statements: D1PreparedStatement[]) => { meter.used += statements.length; return db.batch(statements.map(s => raw.get(s) ?? s)); },
        exec: (sql: string) => { meter.used++; return db.exec(sql); },
        dump: () => db.dump()
    } as unknown as D1Database;
    meters.set(database, meter);
    return database;
}

/** The import route meters its binding before sign-in. Direct callers get a
 * fresh meter for this one operation. */
export function budgeted(c: Context): Context {
    return meters.has(c.db) ? c : new Context({ ...c.env, DB: metered(c.env.DB) }, c.session);
}

/** Statements this request may still run. */
export function left(c: Context): number {
    const meter = meters.get(c.db);
    if (!meter) throw new Error('Import request budget unavailable');
    return REQUEST_STATEMENTS - meter.used;
}
