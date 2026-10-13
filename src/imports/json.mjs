/** Strict JSON admission before JSON.parse: duplicate object keys and excessive
 * nesting are ambiguous export evidence and must not be silently overwritten. */
export function strictJson(text) {
    let p = 0, nodes = 0;
    const fail = () => { throw new Error('Invalid or ambiguous JSON'); }, space = () => { while (/[\x20\x09\x0a\x0d]/.test(text[p] ?? '!'))
        p++; };
    function string() { const start = p++; while (p < text.length) {
        const char = text[p++];
        if (char === '"') {
            const value = JSON.parse(text.slice(start, p));
            if (!value.isWellFormed())
                fail();
            return value;
        }
        if (char === '\\')
            p++;
        else if (char < ' ')
            fail();
    } fail(); }
    function value(depth) { if (depth > 32 || ++nodes > 1000000)
        fail(); space(); const c = text[p]; if (c === '"') {
        string();
        return;
    } if (c === '{' || c === '[') {
        p++;
        space();
        const close = c === '{' ? '}' : ']', keys = new Set();
        if (text[p] === close) {
            p++;
            return;
        }
        while (p < text.length) {
            space();
            if (c === '{') {
                if (text[p] !== '"')
                    fail();
                const key = string();
                if (keys.has(key))
                    fail();
                keys.add(key);
                space();
                if (text[p++] !== ':')
                    fail();
            }
            value(depth + 1);
            space();
            if (text[p] === close) {
                p++;
                return;
            }
            if (text[p++] !== ',')
                fail();
        }
        fail();
    } const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(p)); if (!match)
        fail(); if (/^-?\d/.test(match[0]) && (!Number.isFinite(Number(match[0])) || (Number.isInteger(Number(match[0])) && !Number.isSafeInteger(Number(match[0])))))
        fail(); p += match[0].length; }
    value(0);
    space();
    if (p !== text.length)
        fail();
    return JSON.parse(text);
}
