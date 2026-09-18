# jev-lab

Live tests for [TypeSafe Jev](https://docs.typesafe.ai) through
[OpenRouter's Decisions API](https://openrouter.ai/~typesafe/jev-latest).

Jev is not a chat model. It takes a `state` plus typed questions and returns
calibrated probabilities: yes/no (`noul`), a pick from options you define
(`choice`), or a position on an ordered rubric (`score`). This repo calls that
API with a handful of scenarios so you can see latency, cost, and answers.

## Setup

```bash
make install
cp .env.example .env   # then paste your OpenRouter API key
```

- `OPENROUTER_API_KEY` — from https://openrouter.ai/keys
- `JEV_MODEL` — optional. Default `~typesafe/jev-latest` (currently Jev 1.13).
  Pin with `typesafe/jev-1.13` if you need a fixed version.

The key already used by `../agentic-ai` works. Jev is billed on OpenRouter at
**$0.042 / M input tokens**, output free. Typical cases here cost well under a
cent.

## Run

```bash
make help         # this list
make              # every case
make list         # ids
make ask          # type a state + yes/no question (Jev)
make see          # describe a picture (vision chat model, not Jev)
make smoke        # one case (also: route, verify, account, count, math)
make json         # raw responses
```

| id | What it tests |
|---|---|
| `smoke` | Support-ticket triage: noul + choice + score in one call |
| `route` | Next-tool pick for an agent loop (the intended use) |
| `verify` | Claim vs evidence, a guardrail-style check |
| `account` | Structured JSON state instead of a prose blob |
| `count` | Documented weak spot: counting |
| `math` | Documented weak spot: arithmetic |

`count` and `math` are TypeSafe's own jaggedness notes, not quality demos.
Keep counting and arithmetic in code; ask Jev semantic questions.

`make ask` is Jev: you give a state and a yes/no (or choice/score) question, and
it returns a probability. It will not write a paragraph.

`make see` is a different model. Jev is text-in, decisions-out — no images, no
prose. Description uses a vision chat model (`SEE_MODEL`, default
`inclusionai/ling-3.0-flash-vl:free`):

```bash
make see
make see IMAGE=photo.jpg
```

## Layout

```
src/
  client.ts    OpenRouter POST /api/alpha/decisions
  ask.ts       Interactive / CLI typed question
  see.ts       Image description via a vision chat model
  cases.ts     Scenarios
  format.ts    Terminal report
  run.ts       CLI
  types.ts     Request / response shapes
```

This is a separate endpoint from `/api/v1/chat/completions`. Setting
`OPENROUTER_MODEL=typesafe/jev-1.13` on a chat client will not work.
