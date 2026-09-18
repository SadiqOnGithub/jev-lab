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

function noulQuestion(instructions: string): Question {
  return {
    type: 'noul',
    instructions,
    criteria: {
      true: 'The question is true of the state.',
      false: 'The question is false of the state.',
    },
  };
}

function choiceQuestion(instructions: string, options: string[]): Question {
  if (options.length < 2) throw new Error('Need at least two options.');
  return {
    type: 'choice',
    instructions,
    criteria: Object.fromEntries(options.map((o) => [o, o])),
  };
}

function scoreQuestion(instructions: string, levels: string[]): Question {
  if (levels.length < 2) throw new Error('Need at least two levels.');
  return { type: 'score', instructions, criteria: levels };
}

function printHelp(): void {
  console.log(`Ask Jev typed questions about a state. It does not write prose.

Session (make ask):
  type a yes/no question          noul
  /choice  Which team?            then enter comma-separated options
  /score   How bad?               then enter levels, low to high
  /state                          replace the state (multiline)
  /print                          show the current state
  /help
  /quit

One-shot:
  pnpm exec tsx src/run.ts ask --state "ticket text" --noul "Is this urgent?"
  pnpm exec tsx src/run.ts ask --state "..." --choice "Which team?" --options billing,technical,sales
  pnpm exec tsx src/run.ts ask --state "..." --score "How bad?" --levels "Low,Moderate,High"
`);
}

async function readMultiline(rl: readline.Interface, label: string): Promise<string> {
  console.log(`${label} (empty line to finish)`);
  const lines: string[] = [];
  for (;;) {
    const line = await rl.question('| ');
    if (line.trim() === '') {
      if (lines.length > 0) return lines.join('\n').trim();
      console.log('Need some state first.');
      continue;
    }
    lines.push(line);
  }
}

async function requiredLine(rl: readline.Interface, label: string): Promise<string> {
  for (;;) {
    const v = (await rl.question(`${label} `)).trim();
    if (v) return v;
    console.log('Cannot be empty.');
  }
}

async function runQuestion(stateRaw: string, question: Question): Promise<boolean> {
  const title = typeof question.instructions === 'string' ? question.instructions : 'custom';
  const started = performance.now();
  try {
    const response = await decide({
      state: parseState(stateRaw),
      questions: { answer: question },
    });
    process.stdout.write(
      formatResult({
        id: 'ask',
        title,
        ok: true,
        ms: Math.round(performance.now() - started),
        response,
      }),
    );
    return true;
  } catch (err) {
    process.stdout.write(
      formatResult({
        id: 'ask',
        title,
        ok: false,
        ms: Math.round(performance.now() - started),
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}

function oneshotQuestion(args: string[]): Question | undefined {
  const noul = flag(args, '--noul') ?? flag(args, '--question') ?? flag(args, '-q');
  const choice = flag(args, '--choice');
  const score = flag(args, '--score');
  const kinds = [noul, choice, score].filter(Boolean).length;
  if (kinds > 1) throw new Error('Use only one of --noul, --choice, or --score.');
  if (choice) return choiceQuestion(choice, splitList(flag(args, '--options') ?? ''));
  if (score) return scoreQuestion(score, splitList(flag(args, '--levels') ?? ''));
  if (noul) return noulQuestion(noul);
  return undefined;
}

async function session(
  rl: readline.Interface,
  initialState: string | undefined,
  firstQuestion?: Question,
): Promise<void> {
  console.log(`model ${MODEL}`);
  console.log('Jev returns a probability, not a paragraph.');
  console.log('Plain question = yes/no.  /help for the rest.\n');

  let stateRaw = initialState?.trim() || (await readMultiline(rl, 'State'));
  console.log('');
  if (firstQuestion) {
    const ok = await runQuestion(stateRaw, firstQuestion);
    if (!ok) process.exitCode = 1;
  }

  for (;;) {
    const line = (await rl.question('? ')).trim();
    if (!line) continue;

    const [cmd, ...restParts] = line.split(/\s+/);
    const rest = restParts.join(' ').trim();
    const command = cmd.toLowerCase();

    if (command === '/quit' || command === '/q' || command === '/exit') return;
    if (command === '/help' || command === '/h') {
      printHelp();
      continue;
    }
    if (command === '/print') {
      console.log(stateRaw);
      console.log('');
      continue;
    }
    if (command === '/state') {
      stateRaw = await readMultiline(rl, 'State');
      console.log('');
      continue;
    }
    if (command === '/choice') {
      const instructions = rest || (await requiredLine(rl, 'Choice question:'));
      const options = splitList(await requiredLine(rl, 'Options (comma-separated):'));
      const ok = await runQuestion(stateRaw, choiceQuestion(instructions, options));
      if (!ok) process.exitCode = 1;
      continue;
    }
    if (command === '/score') {
      const instructions = rest || (await requiredLine(rl, 'Score question:'));
      const levels = splitList(await requiredLine(rl, 'Levels (comma-separated, low to high):'));
      const ok = await runQuestion(stateRaw, scoreQuestion(instructions, levels));
      if (!ok) process.exitCode = 1;
      continue;
    }
    if (command.startsWith('/')) {
      console.log(`Unknown command ${cmd}. Try /help.`);
      continue;
    }

    const ok = await runQuestion(stateRaw, noulQuestion(line));
    if (!ok) process.exitCode = 1;
  }
}

export async function ask(args: string[]): Promise<void> {
  if (has(args, '--help') || has(args, '-h')) {
    printHelp();
    return;
  }

  const stateFlag = flag(args, '--state');
  const question = (() => {
    try {
      return oneshotQuestion(args);
    } catch (err) {
      // Incomplete --choice/--score without lists falls through to the session.
      if (input.isTTY && /at least two/.test(err instanceof Error ? err.message : '')) {
        return undefined;
      }
      throw err;
    }
  })();

  if (stateFlag && question) {
    const ok = await runQuestion(stateFlag, question);
    if (!ok) process.exitCode = 1;
    return;
  }

  if (!input.isTTY) {
    throw new Error('Pass --state and --noul/--choice/--score (non-interactive). See --help.');
  }

  const rl = readline.createInterface({ input, output });
  try {
    await session(rl, stateFlag, question);
  } finally {
    rl.close();
  }
}
