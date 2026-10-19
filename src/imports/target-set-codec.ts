/** Lossless dictionary framing for exact native-set predicates. SQLite can
 * reconstruct this using json_each/group_concat; no extension, checksum or
 * trusted application-side assertion replaces comparison of the actual bytes. */
export function encodeTargetSet(tuples: any[][]): { dictionary: string; codes: string; maxTokens: number } {
    const dictionary: string[] = [], indexes = new Map<string,number>();
    const intern = (text: string) => {
        let id=indexes.get(text);
        if(id===undefined) { id=dictionary.length;dictionary.push(text);indexes.set(text,id); }
        return id;
    };
    let rows = tuples.map(tuple => (JSON.stringify(tuple).match(/[A-Za-z0-9_-]+|[^A-Za-z0-9_-]+/g)??[]).map(intern));
    // Merge frequent neighboring fragments in a handful of linear passes.
    // Shared JSON structure, source text and repeated native references then
    // travel once, while every unique byte still participates in the SQL fence.
    for(let pass=0;pass<4;pass++) {
        const counts=new Map<string,number>();
        for(const row of rows) for(let i=1;i<row.length;i++) {
            const key=row[i-1]+':'+row[i];counts.set(key,(counts.get(key)??0)+1);
        }
        const pairs=[...counts].filter(([,count])=>count>=3).sort((a,b)=>b[1]-a[1]).slice(0,512);
        if(!pairs.length) break;
        const merged=new Map(pairs.map(([key])=>{
            const [a,b]=key.split(':').map(Number);return [key,intern(dictionary[a]+dictionary[b])] as const;
        }));
        rows=rows.map(row=>{
            const next:number[]=[];
            for(let i=0;i<row.length;i++) {
                const joined=i+1<row.length?merged.get(row[i]+':'+row[i+1]):undefined;
                if(joined===undefined) next.push(row[i]);else {next.push(joined);i++;}
            }
            return next;
        });
    }
    const used=[...new Set(rows.flat())],remap=new Map(used.map((id,i)=>[id,i]));
    const words=used.map(id=>dictionary[id]),buckets:string[][]=[];
    for(let i=0;i<words.length;i+=128) buckets.push(words.slice(i,i+128));
    const character=(id:number) => String.fromCodePoint(id+256+(id+256>=0xd800?2048:0));
    return {
        dictionary:JSON.stringify(buckets),
        codes:JSON.stringify(rows.map(row=>row.map(id=>character(remap.get(id)!)).join(''))),
        maxTokens:Math.max(0,...rows.map(row=>row.length))
    };
}

/** k.value is the exact original tuple after decoding, including all escaped
 * JSON and non-ASCII text. Code ordinals are explicit, independent of row order. */
const point = 'unicode(substr(code.value,ordinal.n,1))';
const index = `(${point}-256-CASE WHEN ${point}>=57344 THEN 2048 ELSE 0 END)`;
// Bounded two-level lookup avoids walking an ever-growing dictionary per token.
export const decodedTargetSetSql = `WITH RECURSIVE dictionary(body) AS MATERIALIZED (SELECT jsonb(?)), limits(maximum) AS (SELECT ?),
    ordinal(n) AS (SELECT 1 FROM limits WHERE maximum>0 UNION ALL SELECT n+1 FROM ordinal,limits WHERE n<maximum),
    expected(value) AS MATERIALIZED (
        SELECT (SELECT group_concat(fragment,'') FROM (SELECT json_extract(dictionary.body,'$['||(${index}/128)||']['||(${index}%128)||']') fragment FROM ordinal WHERE ordinal.n<=length(code.value) ORDER BY ordinal.n))
        FROM json_each(?) code CROSS JOIN dictionary
    )`;
