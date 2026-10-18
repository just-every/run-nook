export const builtins=[
 ['remind','me|@person|#channel time to text','Create a reminder with a preview'],
 ['invite','@person [#channel]','Add a person to a channel'],['leave','','Leave this channel'],['who','','Show the current conversation members'],
 ['topic','text','Change the channel topic'],['rename','#name','Rename the channel'],['mute','','Toggle conversation mute'],['dnd','duration or time','Pause notifications until the confirmed time'],
 ['status','[emoji] [text]','Set or clear your status'],['away','','Set yourself away'],['active','','Set yourself active'],['msg','@person [text]','Open or send a direct message'],['dm','@person [text]','Open or send a direct message'],
 ['huddle','','Start a conversation call'],['gif','words','Find a GIF'],['shrug','[text]','Send text with a shrug'],['collapse','','Hide inline previews for you'],['expand','','Show inline previews for you'],
] as const
export const builtinNames=new Set<string>(builtins.map(([name])=>name))
