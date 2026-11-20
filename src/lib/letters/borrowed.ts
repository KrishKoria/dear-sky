/**
 * Letters to borrow (fictional, written by us), for someone who arrives with no one in mind and
 * wants to see what Dear Sky does. Each walks the whole path: a margin note, a lantern, and, in
 * the first, a place and names for the leak check to catch if they reach the tag.
 */
export const BORROWED = [
  `Dear Nani,
It's been a year since the hospital in Lucknow, and I still haven't deleted your number. Every Sunday at six my phone stays quiet and I keep waiting for it to ring. Riya says you'd laugh at me for that.
I made your dal last week. It wasn't right. Too much salt, and not enough of you behind me saying "slowly, slowly".
I never told you I chose my college because you said I'd be good at it. I was going to tell you at graduation.
I'm doing okay. Mostly. I wear your shawl when it's cold and pretend it counts as a hug.
Love,
Ananya`,
  `To the night nurse on ward 4,
You won't remember me. My father was dying and I hadn't slept for three days. At 3 am you brought me a cup of sweet tea and a blanket and said I could hold his hand, it was allowed. You stayed a minute longer than you needed to. I think about that minute often. Thank you.`,
  `Arjun,
I didn't come to your wedding. I told everyone it was work, but it was pride, and that fight about the flat. I watched the live video on my phone in the car park outside the hall. You looked so happy. I keep the screenshot of you laughing at the stage. I'm sorry I made you look for me in the crowd.`,
] as const;

let next = Math.floor(Math.random() * BORROWED.length);

/** A different one each time, round the three. */
export function borrowLetter(): string {
  const letter = BORROWED[next];
  next = (next + 1) % BORROWED.length;
  return letter;
}
