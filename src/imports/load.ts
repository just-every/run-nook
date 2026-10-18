import { createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
export const loadImports = createServerFn({ method: 'GET' }).handler(async () => {
    const [{ env }, { getRequestHeaders }, { context }, { owner }, { listImports }, { Fault }] = await Promise.all([import('cloudflare:workers'), import('@tanstack/react-start/server'), import('../platform/storage/context'), import('./custody.ts'), import('./list.ts'), import('../family/team-chat/domain')]);
    try {
        const c = await context(env as any, getRequestHeaders());
        await owner(c);
        return {...await listImports(c),campfireJobs:(await listImports(c,'campfire')).jobs,mattermostJobs:(await listImports(c,'mattermost')).jobs};
    }
    catch (error) {
        if (error instanceof Fault && error.status === 401)
            throw redirect({ href: '/signin' });
        throw error;
    }
});
