/** A household's week, expressed through Nook's channels and threads. */
export const week=[
 {channel:'household',author:0,daysAgo:6,hour:9,minute:10,body:'Welcome to Cedar House. Use this channel for the week ahead, groceries for the shared list, and garden for weekend plans.'},
 {channel:'groceries',author:1,daysAgo:6,hour:11,minute:35,body:'Shared list: oats, coffee beans, oat milk, lemons and washing-up liquid. Anything else before the Thursday shop?',reply:'Please add chickpeas and tomatoes. I am making dinner for everyone on Friday.',replyBy:2,replyAfterMinutes:1380},
 {channel:'garden',author:2,daysAgo:5,hour:8,minute:20,body:'The basil has new leaves! I watered the raised beds this morning. The mint pot needs a bigger saucer.',reply:'There is a spare terracotta one in the shed.',replyBy:1,replyAfterMinutes:1325},
 {channel:'household',author:1,daysAgo:4,hour:14,minute:45,body:'The plumber can visit on Friday between 9 and 11. I can be home to let them in.',reply:'Thanks, Alex. The kitchen tap still drips after it is turned off.',replyBy:0,replyAfterMinutes:23},
 {channel:'groceries',author:2,daysAgo:3,hour:10,minute:12,body:'Pantry check done: plenty of rice and pasta. We only need the fresh ingredients on the shared list.'},
 {channel:'household',author:2,daysAgo:2,hour:16,minute:10,body:'Dinner at seven: chickpea stew, salad and warm bread. A friend is joining us, so we will need four places.',reply:'I will set the table and pick up bread on my way home.',replyBy:1,replyAfterMinutes:52},
 {channel:'garden',author:1,daysAgo:1,hour:8,minute:25,body:'Shall we plant the herb seedlings after breakfast? Forecast looks good for a morning outside.',reply:'Seedlings are in! The rosemary is by the back steps and the basil is in the sunny bed.',replyBy:2,replyAfterMinutes:1440},
 {channel:'household',author:1,daysAgo:0,hour:18,minute:20,body:'Next week: bins go out Tuesday, the library books are due Wednesday, and we are hosting lunch on Saturday.'},
] as const
