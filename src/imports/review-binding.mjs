import { importDigest } from '../family/team-chat/import-capture.mjs';
import { isAutomation } from './slack-records.mjs';
export function reviewMetadata(summary) {
    return summary.reviewDigest ? { reviewDigest: summary.reviewDigest, externalActors: summary.externalActors, skippedKinds: summary.skippedKinds, missingFiles: summary.missingFiles, missingFileInventoryDigest: summary.missingFileInventoryDigest } : {};
}
export function captureArtifactName(summary) {
    return summary.reviewDigest ? `reviewed-slack-capture-${importDigest(reviewMetadata(summary))}.json` : 'reviewed-slack-capture.json';
}
export function validateReviewDecisions(summary, choices, plan) {
    const artifact = plan.source.artifacts[0], name = captureArtifactName(summary);
    const expectedName = plan.erasure ? `erased-artifact:${importDigest([name, artifact?.sha256])}` : name;
    if (artifact?.name !== expectedName) throw Error('slack_review_choices_changed');
    if (!summary.reviewDigest) return; // Previously applied v1 captures retain their byte-exact plans.
    if (summary.reviewDigest !== importDigest(choices) || summary.missingFiles?.accepted !== (choices.importWithoutMissingFiles === true) || summary.missingFiles?.count > 0 && !summary.missingFiles.accepted) throw Error('slack_review_choices_changed');
}
export function actorChoiceMatches(actor, choices, messages, externalActors = []) {
    const external = externalActors.includes(actor.sourceId) || isAutomation(actor.sourceRecord) || messages.some(m => m.sourceActor === actor.sourceId && (m.sourceRecord.bot_id || m.sourceRecord.subtype === 'bot_message'));
    return external ? actor.association === null : choices.actors?.[actor.sourceId] === actor.association;
}
