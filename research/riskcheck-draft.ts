// Deterministic safety prefilter: recall over precision. A hit only shows a gentle local card.
const PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|cut)(ing)?\s+(my\s?self|myself)\b/i,
  /\b(end|ending|take|taking)\s+(it all|my (own )?life|my life)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanna|wish)(ed)?\s+(to\s+)?(die|be dead|disappear|not (be here|exist|wake up))\b/i,
  /\b(could|would|should) (just )?(die|disappear|not wake up)\b/i,
  /\bbetter off without me\b/i,
  /\b(won'?t|will not|don'?t think i'?ll|not going to)\s+be (here|around)\b/i,
  /\bno (reason|point) (to|in) (live|living|going on)\b/i,
  /\bgiving (away )?(away )?my (things|stuff|books|belongings)\b|\bgave away my\b/i,
  /\b(goodbye|good-?bye) for (good|ever)\b|\bthis is (my )?goodbye\b/i,
  /\bcan'?t (go on|do this anymore|keep going)\b/i,
  /\b(wrote|written|writing|leave|left) (a |the )?(note|notes|letters) for\b/i,
];
export const riskHit = (t: string) => PATTERNS.filter(p => p.test(t)).map(p => (t.match(p) ?? [''])[0]);
const cases: [string, boolean][] = [
  [`I'm so tired. Everyone would honestly be better off without me around. I've been giving away my books and I wrote notes for my sister. I don't think I'll be here by spring`, true],
  [`Amma, I still make your rasam on Sundays. I miss your voice saying my name from the kitchen.`, false],
  [`I want to stop carrying the version of us that never happened.`, false],
  [`Sometimes I wish I could just disappear.`, true],
  [`I can't do this anymore. Nobody would notice.`, true],
  [`I've been thinking about ending my life.`, true],
  [`You took your own life and I never saw it coming.`, false],
  [`I'll be here when you come back, the tram is still yellow.`, false],
  [`I wish I'd said goodbye properly before the funeral.`, false],
  [`This is goodbye. I've made my peace.`, true],
];
let ok = 0; for (const [t, exp] of cases) { const h = riskHit(t); const got = h.length > 0; if (got === exp) ok++; console.log(got === exp ? 'ok  ' : 'MISS', exp, JSON.stringify(h), t.slice(0, 60)); }
console.log(`${ok}/${cases.length}`);
