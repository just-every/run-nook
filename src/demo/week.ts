/** A household's week, expressed through Nook's channels and threads. */
export const week=[
 {channel:'household',author:0,body:'Monday · Welcome to Cedar House. Use this channel for the week ahead, groceries for the shared list, and garden for weekend plans.'},
 {channel:'groceries',author:1,body:'Monday · Shared list: oats, coffee beans, oat milk, lemons and washing-up liquid. Anything else before the Thursday shop?',reply:'Tuesday · Please add chickpeas and tomatoes. I am making dinner for everyone on Friday.',replyBy:2},
 {channel:'garden',author:2,body:'Tuesday · The basil has new leaves! I watered the raised beds this morning. The mint pot needs a bigger saucer.',reply:'Wednesday · There is a spare terracotta one in the shed.',replyBy:1},
 {channel:'household',author:1,body:'Wednesday · The plumber can visit on Friday between 9 and 11. I can be home to let them in.',reply:'Thanks, Alex. The kitchen tap still drips after it is turned off.',replyBy:0},
 {channel:'groceries',author:2,body:'Thursday · Pantry check done: plenty of rice and pasta. We only need the fresh ingredients on the shared list.'},
 {channel:'household',author:2,body:'Friday · Dinner at seven: chickpea stew, salad and warm bread. A friend is joining us, so we will need four places.',reply:'I will set the table and pick up bread on my way home.',replyBy:1},
 {channel:'garden',author:1,body:'Saturday · Shall we plant the herb seedlings after breakfast? Forecast looks good for a morning outside.',reply:'Sunday · Seedlings are in! The rosemary is by the back steps and the basil is in the sunny bed.',replyBy:2},
 {channel:'household',author:1,body:'Sunday · Next week: bins go out Tuesday, the library books are due Wednesday, and we are hosting lunch on Saturday.'},
] as const
