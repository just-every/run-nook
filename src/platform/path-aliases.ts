// Plausible paths that name a screen the app already has. A list root goes to its list, and an id under a list goes to
// that conversation; anything else keeps the ordinary not-found page.
const roots:Record<string,string>={
 '/settings':'/app?view=you','/app/settings':'/app?view=you',
 '/channels':'/app?view=channels','/app/channels':'/app?view=channels',
 '/people':'/app?view=people','/app/people':'/app?view=people',
 '/logout':'/app?view=you','/signout':'/app?view=you','/sign-out':'/app?view=you',
 '/app/setup':'/setup',
 '/login':'/signin','/sign-in':'/signin',
}
export function pathAlias(url:URL):string|null{
 if(roots[url.pathname])return roots[url.pathname]
 if(url.pathname==='/app'&&url.searchParams.get('view')==='settings'){const next=new URLSearchParams(url.searchParams);next.set('view','you');return '/app?'+next}
 const channel=/^\/app\/channels\/([^/]+)\/?$/.exec(url.pathname)
 if(channel)try{return '/app?'+new URLSearchParams({conversation:decodeURIComponent(channel[1])})}catch{return null}
 return null
}
