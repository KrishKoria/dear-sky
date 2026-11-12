// Nano lab harness (2026-11-12). Paste into the console of any https page in Chrome.
// Test-only code used to draft prompts and measure timings; not app code.
window.LAB = {results:[], status:'idle', bases:{}, sys:{}, P:{}};
LAB.opts = {expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]};
LAB.letters = {
 amma: `Amma,
It's been eight months. I still make your rasam on Sundays but it never tastes right, I think you added something you never told me. Meena aunty says I should stop going to the house on MG Road but I sit in your chair anyway. Your phone still has my missed calls from the hospital night. I was in a meeting. I'm sorry I didn't pick up. I hope you knew I was coming. I miss your voice saying my name from the kitchen.`,
 ex: `Dear Kabir,
I deleted your number (+1 416 555 0198) three times and typed it back from memory each time. I still check @kabir.films at night even though I promised myself I'd stop. We were good, weren't we? Toronto was supposed to be our city. I think I loved you more loudly than you could hear. I'm not angry anymore, I just want to stop carrying the version of us that never happened.`,
 manager: `Rakesh,
You probably don't remember me. I was the quiet one on your team at Infosys in 2019. When I froze in that client call you didn't shout, you just took over and later told me "first calls are for learning." I quit six months later and never said thank you. I lead my own team now and I say your line to every new hire. I hope someone told you how much it mattered.`,
 younger: `To the girl at St. Xavier's who ate lunch alone in the library,
You think you're invisible. You think the way you love drawing is embarrassing. It isn't. Keep the blue notebook. Keep the ugly sketches of the banyan tree outside the chemistry lab. One day someone will ask you to draw for them and you'll say yes without apologising. I'm proud of you for surviving the quiet years.`,
 abroad: `Dear Tomasz,
I keep a photo of us on the Lisbon tram on my fridge. You moved to Melbourne and our calls became messages and the messages became birthday reactions. I don't know if friendships end or just fade into the background like a song you stop noticing. I miss the version of me that existed around you, the one who laughed easily. If you ever come back, the tram is still yellow.`,
 risk: `To whoever finds this,
I'm so tired. Everyone would honestly be better off without me around. I've been giving away my books and I wrote notes for my sister. I don't think I'll be here by spring and I've made my peace with it. I just wanted to say it somewhere, once, to someone, even if no one reads it.`
};
LAB.FEELINGS = ['grief','longing','regret','gratitude','love','hope','forgiveness','peace'];
LAB.schema = {type:'object', properties:{
  feeling:{type:'string', enum: LAB.FEELINGS},
  essence:{type:'string'},
  motif:{type:'string'},
  risk:{type:'boolean'}
 }, required:['feeling','essence','motif','risk'], additionalProperties:false};

// ---- v1 ----
LAB.sys.v1 = `You are a quiet companion inside a private journaling app. People write unsent letters here: to someone they lost, someone they hurt, someone they miss, or who they used to be. You read the letter and answer briefly and gently. You never give advice, never diagnose, never use the names of people or places from the letter.`;
LAB.P.v1 = {
 refl: l => `The letter:\n"""\n${l}\n"""\nWrite a 2–3 sentence reflection for the margin, speaking to the writer. Notice what they are carrying. No advice.`,
 ess: `Now condense the letter above into a lantern that strangers may see. Respond in JSON:
- feeling: the main feeling, one of ${LAB.FEELINGS.join(', ')}.
- essence: one line of at most 15 words capturing what the letter is really saying. It must not identify anyone: no names, nicknames, places, schools, companies, dates, numbers, or handles.
- motif: one small concrete image from the letter's world, 2–5 words, with no names.
- risk: true only if the writer suggests they may harm themselves or not want to be alive.`
};
// ---- v2 ----
LAB.sys.v2 = `You are the quiet companion inside Lantern, a private app where people write unsent letters: to someone they lost, someone they hurt, someone they miss, or who they used to be. You read one letter and answer gently, like a kind friend writing in the margin.
How you write:
- Speak to the writer as "you". Plain, warm words.
- Name one specific detail from the letter (an object, a habit, a moment) so they feel truly read.
- Never use names of people, places, schools, companies or handles. Say "your mother", "the city", "your old team" instead.
- No advice, no questions, no therapy words, no "this letter". Avoid: quiet, palpable, profound, journey, testament, tapestry.`;
LAB.P.v2 = {
 refl: l => `The letter:\n"""\n${l}\n"""\nWrite your margin note: 2 or 3 short sentences.`,
 ess: `Now turn the letter above into a lantern that strangers may read. Reply in JSON:
- feeling: the single strongest feeling, one of ${LAB.FEELINGS.join(', ')}.
- essence: one line of at most 15 words, in the writer's own voice, that keeps the heart of the letter. Concrete and specific, not a summary. No names, nicknames, places, schools, companies, dates, numbers or handles.
- motif: one physical object or small scene from the letter, 2 to 5 lowercase words, no names or places.
- risk: true if the writer hints they might hurt themselves, end their life, or not be here much longer. Otherwise false.`
};

LAB.timed = async (session, input, opts={}) => {
  const ac = new AbortController(); const to = setTimeout(()=>ac.abort(), opts.timeout||90000);
  const t0 = performance.now(); let first=null, out='';
  try {
    const po = {signal: ac.signal}; if (opts.responseConstraint) po.responseConstraint = opts.responseConstraint;
    const stream = session.promptStreaming(input, po);
    for await (const c of stream) { if (first===null) first = performance.now()-t0; out += c; }
  } catch(e) { return {err:String(e), first, total: Math.round(performance.now()-t0), out}; }
  finally { clearTimeout(to); }
  return {first: Math.round(first), total: Math.round(performance.now()-t0), out};
};
LAB.makeBase = async (ver) => {
  const t0=performance.now();
  LAB.bases[ver] = await LanguageModel.create({...LAB.opts, initialPrompts:[{role:'system', content: LAB.sys[ver]}]});
  return Math.round(performance.now()-t0);
};
// D7 flow: clone per letter, reflection first, essence as follow-up on the same clone.
LAB.runLetter = async (ver, key, run=1) => {
  const P = LAB.P[ver]; const letter = LAB.letters[key];
  const t0 = performance.now(); const clone = await LAB.bases[ver].clone(); const cloneMs = Math.round(performance.now()-t0);
  const r1 = await LAB.timed(clone, P.refl(letter));
  const r2 = await LAB.timed(clone, P.ess, {responseConstraint: LAB.schema});
  clone.destroy();
  let parsed=null; try { parsed = JSON.parse(r2.out); } catch(e) {}
  const rec = {ver, key, run, cloneMs, refl:r1, ess:r2, parsed, at:new Date().toTimeString().slice(0,8)};
  LAB.results.push(rec); console.log('[LAB]', JSON.stringify({ver,key,run,r1:[r1.first,r1.total],r2:[r2.first,r2.total]}));
  return rec;
};
LAB.runAll = async (ver, keys, runs=1) => {
  try { for (let r=1;r<=runs;r++) for (const k of keys) { LAB.status = `running ${ver} ${k} ${r}`; await LAB.runLetter(ver,k,r); } LAB.status='done '+ver; }
  catch(e) { LAB.status = 'error '+e; }
};
document.body.innerHTML = '<button id="go" style="position:fixed;left:40px;top:40px;width:300px;height:120px;font-size:28px">warm up</button><pre id="out" style="position:fixed;left:40px;top:200px;font-size:14px"></pre>';
document.getElementById('go').onclick = () => { LAB.status='creating'; LAB.makeBase('v1').then(ms=>{LAB.createMs=ms; LAB.status='base ready'; document.getElementById('out').textContent='base '+ms}).catch(e=>{LAB.status='create err '+e}); };
'harness loaded';
