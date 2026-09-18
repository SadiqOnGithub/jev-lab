import 'dotenv/config';
import type { DecideRequest, DecideResponse } from './types.js';

const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

export const MODEL = process.env.JEV_MODEL ?? '~typesafe/jev-latest';

export function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set. Copy .env.example to .env and fill it in.');
  }
  return apiKey;
}

/**
 * Call OpenRouter's Decisions API. Jev does not speak chat/completions —
 * it answers typed questions about `state` and returns probabilities.
 */
export async function decide(
  req: DecideRequest,
  opts: { maxRetries?: number } = {},
): Promise<DecideResponse> {
  const apiKey = requireApiKey();

  const retries = opts.maxRetries ?? 2;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(DECISIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'jev-lab',
        },
        body: JSON.stringify({
          model: req.model ?? MODEL,
          state: req.state,
          questions: req.questions,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      const body = await res.text();
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status}: ${body}`);
        }
        throw Object.assign(new Error(`OpenRouter error HTTP ${res.status}: ${body}`), { fatal: true });
      }

      return JSON.parse(body) as DecideResponse;
    } catch (err: unknown) {
      lastErr = err;
      const fatal = typeof err === 'object' && err !== null && 'fatal' in err;
      if (fatal) throw err;
      if (attempt < retries) {
        const waitMs = 2000 * (attempt + 1);
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[jev] transient error (${msg.slice(0, 120)}); retrying in ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastErr;
}
