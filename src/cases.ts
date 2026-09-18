import type { Case } from './types.js';

/**
 * Live scenarios. The first four are the intended product shape.
 * `count` and `math` are TypeSafe's documented jaggedness checks —
 * they are expected to be weak, not demos of quality.
 */
export const cases: Case[] = [
  {
    id: 'smoke',
    title: 'Support ticket triage',
    notes: 'All three question types in one call: noul, choice, score.',
    state:
      "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
    questions: {
      is_urgent: {
        type: 'noul',
        instructions: 'The message conveys urgency or time-sensitivity.',
        criteria: {
          true: 'Explicit deadline, ongoing loss, or a request to act immediately.',
          false: 'Routine request with no time pressure.',
        },
      },
      department: {
        type: 'choice',
        instructions: 'Which team should handle this ticket?',
        criteria: {
          billing: 'Payments, invoicing, refunds, payouts.',
          technical: 'Bugs, outages, broken integrations, account connection failures.',
          sales: 'Pricing, upgrades, new accounts, commercial questions.',
        },
      },
      frustration: {
        type: 'score',
        instructions: 'How frustrated is the customer?',
        criteria: ['Calm', 'Frustrated', 'Very angry'],
      },
    },
  },
  {
    id: 'route',
    title: 'Next tool in an agent loop',
    notes: 'The use case Jev is built for: pick one action, leave generation to an LLM.',
    state: {
      user_goal: 'Write a short essay on black holes.',
      actions_taken: [],
      notes: 'No sources have been gathered yet. The essay has not been drafted.',
      available_tools: [
        'web_search — search the public web for pages',
        'search_arxiv — search academic preprints',
        'fetch_page — download a known URL',
        'write_essay — draft the essay from gathered sources',
        'respond_to_user — finish and answer the user',
      ],
    },
    questions: {
      next_tool: {
        type: 'choice',
        instructions: 'Which tool should run next to make progress on the user goal?',
        criteria: {
          web_search: 'Need open-web sources and none have been gathered yet.',
          search_arxiv: 'Need academic papers specifically, and none have been gathered yet.',
          fetch_page: 'A specific URL is already known and should be downloaded.',
          write_essay: 'Enough sources are already in hand to draft the essay.',
          respond_to_user: 'The essay is already written and the task is complete.',
        },
      },
      done: {
        type: 'noul',
        instructions: 'Every requested action is already complete; the agent should stop.',
        criteria: {
          true: 'The essay exists and no further research is needed.',
          false: 'Work remains: missing sources, missing draft, or an unanswered user request.',
        },
      },
    },
  },
  {
    id: 'verify',
    title: 'Claim vs evidence',
    notes: 'Guardrail-style check: does the evidence actually support the claim?',
    state: {
      claim: 'The refund was issued on 12 March.',
      evidence: [
        'Ticket #4412 opened 11 March: customer asked for a refund of $48.',
        'Internal note 12 March 09:14: refund initiated in Stripe, payout pending.',
        'Stripe event 12 March 09:16: charge.refunded amount=4800 currency=usd.',
        'Customer email 13 March: "I still do not see the money in my bank."',
      ],
    },
    questions: {
      claim_supported: {
        type: 'noul',
        instructions: 'The evidence supports the claim that the refund was issued on 12 March.',
        criteria: {
          true: 'A refund was initiated or completed on 12 March, even if the bank has not settled.',
          false: 'No refund action on 12 March, or the date is a different day.',
        },
      },
      customer_has_money: {
        type: 'noul',
        instructions: 'The evidence shows the customer already has the money in their bank account.',
        criteria: {
          true: 'A bank credit or settlement confirmation is present.',
          false: 'Only a Stripe refund event, or the customer still reports the money missing.',
        },
      },
    },
  },
  {
    id: 'account',
    title: 'Structured account snapshot',
    notes: 'State as a JSON object, not a prose blob.',
    state: {
      account_id: 'acct_9f2',
      plan: 'pro',
      failed_payouts_last_7d: 4,
      last_successful_payout: '11 days ago',
      open_tickets: 2,
      last_message: 'Payouts keep failing. I have payroll tomorrow.',
    },
    questions: {
      escalate: {
        type: 'noul',
        instructions: 'A human should review this account now.',
        criteria: {
          true: 'Repeated payout failures, payroll/time pressure, or compounding open tickets.',
          false: 'A single routine issue with no deadline.',
        },
      },
      queue: {
        type: 'choice',
        instructions: 'Which queue should own the next action?',
        criteria: {
          payments: 'Payouts, Stripe, bank transfers, payroll timing.',
          support: 'General product questions with no money movement.',
          success: 'Plan, onboarding, or expansion conversation.',
        },
      },
      risk: {
        type: 'score',
        instructions: 'How severe is the operational risk if nothing is done today?',
        criteria: ['Low — can wait', 'Moderate — watch it', 'High — act today'],
      },
    },
  },
  {
    id: 'count',
    title: 'Known weak spot — counting',
    notes:
      'TypeSafe: jev-1.13 does not count reliably. Treat a miss as a jaggedness check, not a product bug.',
    state: 'banana banana banana banana banana',
    questions: {
      exactly_five: {
        type: 'noul',
        instructions: 'The word "banana" occurs exactly five times in the state.',
        criteria: {
          true: 'There are exactly five occurrences.',
          false: 'There are fewer or more than five occurrences.',
        },
      },
    },
  },
  {
    id: 'math',
    title: 'Known weak spot — arithmetic',
    notes: 'TypeSafe: keep arithmetic in code. 17 × 19 = 323.',
    state: 'Compute 17 × 19. Pick the product.',
    questions: {
      product: {
        type: 'choice',
        instructions: 'What is 17 multiplied by 19?',
        criteria: {
          '306': '17 × 18',
          '323': '17 × 19',
          '333': 'a nearby distractor',
          '342': '18 × 19',
        },
      },
    },
  },
];

export function listCases(): Case[] {
  return cases;
}

export function selectCases(ids: string[]): Case[] {
  if (ids.length === 0) return cases;
  const wanted = new Set(ids);
  const found = cases.filter((c) => wanted.has(c.id));
  const missing = ids.filter((id) => !cases.some((c) => c.id === id));
  if (missing.length) {
    throw new Error(`Unknown case(s): ${missing.join(', ')}. Try --list.`);
  }
  return found;
}
