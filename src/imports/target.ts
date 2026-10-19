import type { D1TargetAdapter } from './kit.ts';
import { readTarget, listTargets, targetMatches, targetMatchParts, targetsMatchMany, sql } from './target-snapshot.ts';
import { redactionScope } from './target-redaction.ts';
import { writeTarget } from './target-write.ts';
import { removeTarget } from './target-remove.ts';

export function importTargets(): D1TargetAdapter {
    return {
        read: readTarget, list: listTargets,
        matches: targetMatches, matchesParts: targetMatchParts,
        matchesMany: targetsMatchMany,
        matchesCount: (count,destination) => sql('(SELECT COUNT(*) FROM nook_import_effect_revisions WHERE destination=?)=?',destination,count),
        redaction: redactionScope,
        write: writeTarget, remove: removeTarget
    };
}
