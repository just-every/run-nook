// Exported names are inventory only. Tokens, URLs and arbitrary log fields are
// deliberately excluded: no source integration is installed or executed.
export function slackIntegrations(files, users, bots) {
    const items = new Map();
    const add = (id, name, kind) => {
        if (typeof name !== 'string' || !name.trim()) return;
        name = name.trim().slice(0, 200);
        const lower = name.toLowerCase();
        const disposition = /polly|simple poll/.test(lower) ? 'Recreate polls under NOOK-070'
            : /remind/.test(lower) ? 'Recreate reminders under NOOK-033'
            : /geekbot|standuply|donut/.test(lower) ? 'NOOK-026 templates are not built'
            : kind === 'webhook' ? 'Approve a new NOOK-063 webhook in Apps and repoint it manually; source credentials are not reused'
            : 'Unsupported: exported configuration cannot be executed or transferred';
        items.set(kind + ':' + id, {id: String(id).slice(0,128), name, kind, disposition});
    };
    for (const user of users) if (user.is_bot || user.is_app_user) add(user.id, user.profile?.display_name || user.real_name || user.name || user.id, 'bot/app');
    for (const bot of bots) { add(bot.id, bot.name, 'bot/app'); if (bot.bot_profile?.app_id) add(bot.bot_profile.app_id,bot.name,'app'); }
    if (files.has('integration_logs.json')) {
        const logs = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files.get('integration_logs.json')));
        if (!Array.isArray(logs) || logs.length > 100000 || logs.some(r=>!r || typeof r!=='object' || Array.isArray(r))) throw Error('SLACK_INVALID: integration logs');
        logs.forEach((row,index)=>add(row.app_id || row.service_id || String(index),row.app_name || row.service_name || row.name || row.service_type || 'Unnamed integration', /webhook/i.test(row.service_type || row.type || '') ? 'webhook' : /slash/i.test(row.service_type || row.type || '') ? 'slash command' : /workflow/i.test(row.service_type || row.type || '') ? 'workflow' : 'app'));
    }
    return [...items.values()].sort((a,b)=>(a.kind+a.id).localeCompare(b.kind+b.id));
}
