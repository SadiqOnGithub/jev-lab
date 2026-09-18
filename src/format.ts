import type { Answer, CaseResult } from './types.js';

const tty = process.stdout.isTTY === true;
const dim = (s: string) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s: string) => (tty ? `\x1b[1m${s}\x1b[0m` : s);

function pct(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(2);
}

function usd(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  if (n === 0) return '$0';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  return `$${n.toFixed(6)}`;
}

function dist(probs: Record<string, number> | undefined): string {
  if (!probs) return '';
  return Object.entries(probs)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join('  ');
}

function formatAnswer(name: string, answer: Answer): string[] {
  const pad = name.padEnd(18);
  switch (answer.type) {
    case 'noul':
      return [`  ${pad} noul    ${pct(answer.noul)}`];
    case 'choice': {
      const conf = answer.confidence !== undefined ? `   conf ${pct(answer.confidence)}` : '';
      const lines = [`  ${pad} choice  ${answer.choice}${conf}`];
      const d = dist(answer.probabilities);
      if (d) lines.push(`  ${''.padEnd(18)} ${dim(d)}`);
      return lines;
    }
    case 'score': {
      const conf = answer.confidence !== undefined ? `   conf ${pct(answer.confidence)}` : '';
      const lines = [`  ${pad} score   ${pct(answer.score)}${conf}`];
      if (answer.legend) {
        const labels = Object.entries(answer.legend)
          .map(([k, v]) => `${k}:${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('  ');
        lines.push(`  ${''.padEnd(18)} ${dim(labels)}`);
      }
      const d = dist(answer.probabilities);
      if (d) lines.push(`  ${''.padEnd(18)} ${dim(d)}`);
      return lines;
    }
  }
}

export function formatResult(result: CaseResult): string {
  const header = `${bold(result.id)}  ${result.title}`;
  if (!result.ok || !result.response) {
    return [`── ${header}`, `   ${result.ms}ms`, `   error: ${result.error}`, ''].join('\n');
  }

  const r = result.response;
  const meta = [
    `${result.ms}ms`,
    usd(r.usage.cost),
    `${r.usage.input_tokens}→${r.usage.output_tokens}`,
    r.model,
    r.provider ?? '',
  ]
    .filter(Boolean)
    .join('  ');

  const lines = [`── ${header}`, `   ${dim(meta)}`];
  if (result.notes) lines.push(`   ${dim(result.notes)}`);
  for (const [name, answer] of Object.entries(r.answers)) {
    lines.push(...formatAnswer(name, answer));
  }
  lines.push('');
  return lines.join('\n');
}

export function formatTotals(results: CaseResult[]): string {
  const ok = results.filter((r) => r.ok).length;
  const ms = results.reduce((s, r) => s + r.ms, 0);
  const cost = results.reduce((s, r) => s + (r.response?.usage.cost ?? 0), 0);
  const inn = results.reduce((s, r) => s + (r.response?.usage.input_tokens ?? 0), 0);
  const out = results.reduce((s, r) => s + (r.response?.usage.output_tokens ?? 0), 0);
  return [
    '── totals',
    `   ${ok}/${results.length} ok  ${ms}ms  ${usd(cost)}  ${inn}→${out} tokens`,
    '',
  ].join('\n');
}
