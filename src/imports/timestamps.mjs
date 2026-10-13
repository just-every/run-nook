/** Slack timestamps are validated decimal seconds with six fractional digits.
 * Compare integer microseconds so twelve-digit seconds and leading zeroes never
 * lose precision. The original source strings remain untouched. */
export function compareSourceTimestamps(left, right) {
    const a = BigInt(left.replace('.', '')), b = BigInt(right.replace('.', ''));
    return a < b ? -1 : a > b ? 1 : 0;
}
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const compareSourceMessages = (a, b) => compareText(a.channel, b.channel)
    || compareSourceTimestamps(a.sourceTimestamp, b.sourceTimestamp)
    || compareText(a.key, b.key);
