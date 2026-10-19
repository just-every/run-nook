import { publicCampfire, publicMattermostInspection, summaryCampfire, mattermostSummary, campfireFileHashes, mattermostFileHashes } from '../formats.mjs';

export function publicLocalInspection(inspected: any, kind: string, users: any[]) {
  if (kind === 'mattermost') return publicMattermostInspection(inspected, users);
  if (kind === 'campfire') return publicCampfire(inspected, users);
  return {
    sourceType: 'slack',
    channels: inspected.channels.map((channel: any) => ({ sourceId: channel.id, name: channel.name, visibility: 'public' })),
    actors: inspected.actors, omissions: inspected.omissions,
    completeness: inspected.completeness, sourceAuthenticityVerified: false,
  };
}

/** The previous preview's public fields, without importing its storage service. */
export function publicLocalSummary(capture: any) {
  const result = capture.sourceType === 'mattermost' ? mattermostSummary(capture)
    : capture.sourceType === 'campfire' ? summaryCampfire(capture) : {
      sourceType: 'slack', reviewDigest: capture.reviewDigest, externalActors: capture.externalActors,
      skippedKinds: capture.skippedKinds, missingFiles: capture.missingFiles,
      missingFileInventoryDigest: capture.missingFileInventoryDigest, counts: capture.counts,
      omissions: capture.omissions, omissionDigest: capture.omissionDigest,
      omissionsAccepted: capture.omissionsAccepted, blockers: capture.blockers, blocked: capture.blocked,
      channels: capture.channels.map(({ sourceRecord, ...channel }: any) => channel),
      actors: capture.actors.map(({ sourceRecord, ...actor }: any) => actor),
      archiveDigest: capture.archiveDigest, captureDigest: capture.digest,
      completeness: 'unknown', sourceAuthenticityVerified: false,
    };
  return {
    ...result,
    ...(capture.sourceType === 'mattermost' ? {
      fileHashes: mattermostFileHashes(capture),
      emojiHashes: capture.channels.flatMap((channel: any) => channel.sourceRecord.emojiCatalog.map(({ base64, ...emoji }: any) => emoji)),
    } : capture.sourceType === 'campfire' ? { fileHashes: campfireFileHashes(capture) } : {}),
    missingFileInventory: capture.missingFileInventory,
    needsOmissionReview: !capture.blocked && !capture.omissionsAccepted,
  };
}
