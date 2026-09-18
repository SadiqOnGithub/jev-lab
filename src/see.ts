import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { requireApiKey } from './client.js';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.SEE_MODEL ?? 'inclusionai/ling-3.0-flash-vl:free';
const DEFAULT_PROMPT =
  'Describe this image in a few sentences. What is it, what is in it, and any notable text or details.';
const MAX_BYTES = 10 * 1024 * 1024;

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i === args.length - 1) return undefined;
  const v = args[i + 1];
  if (v.startsWith('--')) return undefined;
  return v;
}

function positional(args: string[]): string | undefined {
  const takesValue = new Set(['--image', '--prompt']);
  for (let i = 0; i < args.length; i++) {
    if (takesValue.has(args[i])) {
      i += 1;
      continue;
    }
    if (!args[i].startsWith('--')) return args[i];
  }
  return undefined;
}

async function promptLine(label: string): Promise<string> {
  if (!input.isTTY) throw new Error(`Missing ${label.toLowerCase()}. Pass it as an argument.`);
  const rl = readline.createInterface({ input, output });
  try {
    const v = (await rl.question(`${label} `)).trim();
    if (!v) throw new Error(`Missing ${label.trim().replace(/:$/, '').toLowerCase()}.`);
    return v;
  } finally {
    rl.close();
  }
}

async function imageUrl(pathOrUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const ext = extname(pathOrUrl).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    throw new Error(`Unsupported image type "${ext || 'unknown'}". Use png, jpg, gif, or webp.`);
  }
  const buf = await readFile(pathOrUrl);
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(`Image is ${(buf.byteLength / (1024 * 1024)).toFixed(1)} MiB; max is 10 MiB.`);
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export async function see(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Describe a picture with a vision chat model. This is not Jev.

  make see
  make see IMAGE=photo.jpg
  pnpm exec tsx src/run.ts see photo.jpg
  pnpm exec tsx src/run.ts see photo.jpg --prompt "What text is on the sign?"

Env: SEE_MODEL  default ${DEFAULT_MODEL}
`);
    return;
  }

  const apiKey = requireApiKey();
  let image = flag(args, '--image') ?? positional(args);
  let prompt = flag(args, '--prompt') ?? DEFAULT_PROMPT;

  if (!image) {
    console.log(`model ${DEFAULT_MODEL}`);
    console.log('Jev cannot see pictures. This call uses a vision chat model.\n');
    image = await promptLine('Image path or URL:');
    const custom = await (async () => {
      if (!input.isTTY) return '';
      const rl = readline.createInterface({ input, output });
      try {
        return (await rl.question('Prompt [describe the image]: ')).trim();
      } finally {
        rl.close();
      }
    })();
    if (custom) prompt = custom;
  }

  const url = await imageUrl(image);
  const started = performance.now();
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'jev-lab',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter error HTTP ${res.status}: ${body}`);
  }

  const data = JSON.parse(body) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`No description in response: ${body.slice(0, 500)}`);

  const ms = Math.round(performance.now() - started);
  const inn = data.usage?.prompt_tokens ?? '?';
  const out = data.usage?.completion_tokens ?? '?';
  console.log(`── see  ${image}`);
  console.log(`   ${ms}ms  ${inn}→${out}  ${data.model ?? DEFAULT_MODEL}`);
  console.log('');
  console.log(text);
  console.log('');
}
