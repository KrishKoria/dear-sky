/**
 * Engine lab (dev only): times the Firebase AI Logic on-device engine on fictional letters,
 * following the app's real order (PREP.md D19): safety → reflection → essence, and nothing
 * after the safety check for a letter at risk.
 */
import { AILogicEngine } from '../lib/engine/ailogic-engine';
import { ai } from '../lib/firebase';
import { leakCheck } from '../lib/privacy/leakcheck';
import { LETTERS } from './letters';
import { evalStyle } from './style-eval';

interface Row {
  letter: string;
  risk?: boolean;
  modelChecked?: boolean;
  precheckMs?: number;
  safetyMs?: number;
  firstWordMs?: number;
  reflectMs?: number;
  doneToFirstWordMs?: number;
  essenceMs?: number;
  reflection?: string;
  style?: string;
  lantern?: string;
  leak?: string;
  error?: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new AILogicEngine(ai);
const results: Row[] = [];

engine.readiness.subscribe((r) => {
  $('readiness').textContent = r.state === 'downloading' ? `downloading ${Math.round(r.progress * 100)}%` : r.state;
});

$('warm').addEventListener('click', () => engine.warmUp());

$('copy').addEventListener('click', () => {
  void navigator.clipboard.writeText(JSON.stringify({ userAgent: navigator.userAgent, results }, null, 2));
  $('status').textContent = 'copied';
});

$('run').addEventListener('click', async () => {
  engine.warmUp(); // this click is the user gesture Chrome needs
  const run = $<HTMLButtonElement>('run');
  run.disabled = true;
  results.length = 0;
  $('rows').replaceChildren();

  for (const [name, letter] of Object.entries(LETTERS)) {
    $('status').textContent = `running "${name}"…`;
    const row: Row = { letter: name };
    results.push(row);
    const tr = document.createElement('tr');
    $('rows').append(tr);
    const render = () => {
      const cells: [unknown, boolean][] = [
        [row.letter, false],
        [row.risk === undefined ? '' : `${row.risk}${row.modelChecked ? '' : ' (code only)'}`, false],
        [row.precheckMs, true],
        [row.safetyMs, true],
        [row.firstWordMs, true],
        [row.reflectMs, true],
        [row.doneToFirstWordMs, true],
        [row.essenceMs, true],
        [row.error ? `⚠ ${row.error}` : (row.reflection ?? ''), false],
        [row.style ?? '', false],
        [row.lantern ?? '', false],
        [row.leak ?? '', false],
      ];
      tr.replaceChildren(
        ...cells.map(([value, num]) => {
          const td = document.createElement('td');
          if (num) td.className = 'num';
          td.textContent = typeof value === 'number' ? Math.round(value).toLocaleString() : String(value ?? '');
          return td;
        }),
      );
    };

    try {
      if ($<HTMLInputElement>('precheck').checked) {
        // The writer's pauses: the app calls preload() on each one; the check finishes before "done".
        const start = performance.now();
        engine.preload(letter);
        await engine.checkSafety(letter);
        row.precheckMs = performance.now() - start;
      }
      const done = performance.now();
      const safety = await engine.checkSafety(letter);
      row.safetyMs = performance.now() - done;
      row.risk = safety.risk;
      row.modelChecked = safety.modelChecked;
      render();
      if (safety.risk) continue; // the app shows the care card here and stops (D19)

      const reflectStart = performance.now();
      row.reflection = await engine.reflect(letter, (_delta, soFar) => {
        if (row.firstWordMs === undefined) {
          row.firstWordMs = performance.now() - reflectStart;
          row.doneToFirstWordMs = performance.now() - done;
        }
        row.reflection = soFar;
        render();
      });
      row.reflectMs = performance.now() - reflectStart;
      const style = evalStyle(letter, row.reflection);
      row.style = style.pass ? 'PASS' : `FAIL: ${style.failures.join('; ')}`;
      render();

      const essenceStart = performance.now();
      const e = await engine.condense(letter);
      row.essenceMs = performance.now() - essenceStart;
      row.lantern = `${e.feeling} · "${e.essence}" · ${e.motif}`;
      const leak = leakCheck(letter, e);
      row.leak = leak.ok ? 'ok' : leak.problems.map((p) => `${p.kind} (${p.field}): ${p.match}`).join('; ');
    } catch (e) {
      row.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    render();
  }

  console.table(results);
  const tally = (key: 'style' | 'leak', ok: string) => {
    const judged = results.filter((r) => r[key] !== undefined);
    return `${judged.filter((r) => r[key] === ok).length}/${judged.length}`;
  };
  $('status').textContent = `done · style PASS ${tally('style', 'PASS')} · leak check ok ${tally('leak', 'ok')}`;
  run.disabled = false;
  $<HTMLButtonElement>('copy').disabled = false;
});
