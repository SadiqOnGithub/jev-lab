import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { decide, MODEL } from './client.js';
import { formatResult } from './format.js';
import type { Question } from './types.js';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i === args.length - 1) return undefined;
  const v = args[i + 1];
  if (v.startsWith('--')) return undefined;
  return v;
}

function has(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseState(raw: string): string | Record<string, unknown> | unknown[] {
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t) as Record<string, unknown> | unknown[];
    } catch {
      return raw;
    }
  }
  return raw;
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function prompt(rl: readline.Interface, label: string): Promise<string> {
  const v = (await rl.question(`${label} `)).trim();
  if (!v) throw new Error(`Missing ${label.trim().replace(/:$/, '').toLowerCase()}.`);
  return v;
}

export async function ask(args: string[]): Promise<void> {
  if (has(args, '--help') || has(args, '-h')) {
    console.log(`Ask Jev one typed question about a state. It does not write prose.

  make ask
  pnpm exec tsx src/run.ts ask --state "ticket text" --noul "Is this urgent?"
  pnpm exec tsx src/run.ts ask --state "..." --choice "Which team?" --options billing,technical,sales
  pnpm exec tsx src/run.ts ask --state "..." --score "How bad?" --levels "Low,Moderate,High"

Jev cannot read images. To describe a picture, use: make see
`);
    return;
  }

  if (has(args, '--image') || flag(args, '--image')) {
    throw new Error('Jev cannot read images. Use `make see` to describe a picture with a vision chat model.');
  }

  let stateRaw = flag(args, '--state');
  let noul = flag(args, '--noul') ?? flag(args, '--question') ?? flag(args, '-q');
  let choice = flag(args, '--choice');
  let score = flag(args, '--score');
  let options = flag(args, '--options');
  let levels = flag(args, '--levels');

  const kinds = [noul, choice, score].filter(Boolean).length;
  if (kinds > 1) throw new Error('Use only one of --noul, --choice, or --score.');

  const needPrompt =
    !stateRaw ||
    (!noul && !choice && !score) ||
    (choice && !options) ||
    (score && !levels);

  let rl: readline.Interface | undefined;
  if (needPrompt) {
    if (!input.isTTY) {
      throw new Error('Pass --state and --noul/--choice/--score (non-interactive). See --help.');
    }
    rl = readline.createInterface({ input, output });
    console.log(`model ${MODEL}`);
    console.log('Jev returns a probability, not a paragraph.\n');
    if (!stateRaw) stateRaw = await prompt(rl, 'State (what to judge):');
    if (!noul && !choice && !score) {
      noul = await prompt(rl, 'Yes/no question:');
    } else if (choice && !options) {
      options = await prompt(rl, 'Options (comma-separated):');
    } else if (score && !levels) {
      levels = await prompt(rl, 'Levels (comma-separated, low to high):');
    }
    rl.close();
    rl = undefined;
  }

  if (!stateRaw) throw new Error('Missing --state.');

  let question: Question;
  if (choice) {
    const opts = splitList(options ?? '');
    if (opts.length < 2) throw new Error('--choice needs at least two --options.');
    question = {
      type: 'choice',
      instructions: choice,
      criteria: Object.fromEntries(opts.map((o) => [o, o])),
    };
  } else if (score) {
    const lv = splitList(levels ?? '');
    if (lv.length < 2) throw new Error('--score needs at least two --levels.');
    question = { type: 'score', instructions: score, criteria: lv };
  } else {
    if (!noul) throw new Error('Missing yes/no question (--noul).');
    question = {
      type: 'noul',
      instructions: noul,
      criteria: {
        true: 'The question is true of the state.',
        false: 'The question is false of the state.',
      },
    };
  }

  const started = performance.now();
  try {
    const response = await decide({
      state: parseState(stateRaw),
      questions: { answer: question },
    });
    process.stdout.write(
      formatResult({
        id: 'ask',
        title: typeof question.instructions === 'string' ? question.instructions : 'custom',
        ok: true,
        ms: Math.round(performance.now() - started),
        response,
      }),
    );
  } catch (err) {
    process.stdout.write(
      formatResult({
        id: 'ask',
        title: 'custom question',
        ok: false,
        ms: Math.round(performance.now() - started),
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exitCode = 1;
  } finally {
    rl?.close();
  }
}
