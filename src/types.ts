/** Guidance Jev reads: a string, or a small JSON object/array. */
export type Guidance = string | Record<string, unknown> | unknown[];

export type NoulQuestion = {
  type: 'noul';
  instructions: Guidance;
  criteria?: { true: Guidance; false: Guidance };
};

export type ChoiceQuestion = {
  type: 'choice';
  instructions: Guidance;
  criteria: Record<string, Guidance>;
};

export type ScoreQuestion = {
  type: 'score';
  instructions: Guidance;
  criteria: Guidance[];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = { type: 'noul'; noul: number };

export type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export type ScoreAnswer = {
  type: 'score';
  score: number;
  confidence?: number;
  legend?: Record<string, Guidance>;
  probabilities?: Record<string, number>;
};

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type DecideRequest = {
  model?: string;
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, Question>;
};

export type DecideResponse = {
  id?: string;
  model: string;
  provider?: string;
  answers: Record<string, Answer>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost?: number;
  };
};

export type Case = {
  id: string;
  title: string;
  /** Shown in the report; not sent to Jev. */
  notes?: string;
  state: DecideRequest['state'];
  questions: Record<string, Question>;
};

export type CaseResult = {
  id: string;
  title: string;
  notes?: string;
  ok: boolean;
  ms: number;
  response?: DecideResponse;
  error?: string;
};
