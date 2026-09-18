import { decide, MODEL } from './client.js';
import { listCases, selectCases } from './cases.js';
import { formatResult, formatTotals } from './format.js';
import type { Case, CaseResult } from './types.js';

function usage(): never {
  console.log(`jev-lab — live tests for TypeSafe Jev via OpenRouter

Usage:
  npm start                 run every case
  npm start -- --list       list case ids
  npm start -- smoke route  run named cases
  npm start -- --json       print raw JSON instead of a report

Env:
  OPENROUTER_API_KEY        required
  JEV_MODEL                 default ${MODEL}
`);
  process.exit(0);
}

async function runCase(c: Case): Promise<CaseResult> {
  const started = performance.now();
  try {
    const response = await decide({ state: c.state, questions: c.questions });
    return {
      id: c.id,
      title: c.title,
      notes: c.notes,
      ok: true,
      ms: Math.round(performance.now() - started),
      response,
    };
  } catch (err) {
    return {
      id: c.id,
      title: c.title,
      notes: c.notes,
      ok: false,
      ms: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) usage();

  if (args.includes('--list')) {
    for (const c of listCases()) {
      console.log(`${c.id.padEnd(10)} ${c.title}`);
      if (c.notes) console.log(`${''.padEnd(10)} ${c.notes}`);
    }
    return;
  }

  const asJson = args.includes('--json');
  const ids = args.filter((a) => !a.startsWith('--'));
  const selected = selectCases(ids);

  if (!asJson) {
    console.log(`model ${MODEL}`);
    console.log(`cases ${selected.map((c) => c.id).join(', ')}`);
    console.log('');
  }

  const results: CaseResult[] = [];
  for (const c of selected) {
    const result = await runCase(c);
    results.push(result);
    if (!asJson) process.stdout.write(formatResult(result));
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  process.stdout.write(formatTotals(results));
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
