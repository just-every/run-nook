// Slack's message text format (https://api.slack.com/reference/surfaces/formatting):
// mentions, channel references, special mentions and links are <...> tokens, and
// a literal &, < or > is escaped as &amp;, &lt; or &gt;. Imported history shows,
// searches the plain reading; the stored record and exports keep Slack's text.
const escapes = { '&amp;': '&', '&lt;': '<', '&gt;': '>' };
const decode = text => text.replace(/&(?:amp|lt|gt);/g, match => escapes[match]);
function token(inner, names, channels) {
    const bar = inner.indexOf('|'), target = bar < 0 ? inner : inner.slice(0, bar), label = bar < 0 ? '' : decode(inner.slice(bar + 1));
    if (target.startsWith('@')) return '@' + (names.get(target.slice(1)) ?? (label || target.slice(1)));
    if (target.startsWith('#')) return '#' + (channels.get(target.slice(1)) ?? (label || target.slice(1)));
    if (target.startsWith('!subteam^')) return label || '@group';
    if (target.startsWith('!date^')) return label || target;
    if (target.startsWith('!')) return label || '@' + target.slice(1);
    return label || decode(target).replace(/^mailto:/, '');
}
/** Plain text for Slack message text; names and channels map source IDs to labels. */
export function slackPlainText(text, names = new Map(), channels = new Map()) {
    return text.split(/(<[^<>]*>)/).map(part => part.startsWith('<') && part.endsWith('>') ? token(part.slice(1, -1), names, channels) : decode(part)).join('');
}
