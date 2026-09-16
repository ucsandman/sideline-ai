// Pluggable LLM provider. Default provider is OpenAI chat completions,
// keyed by the public build-time env var EXPO_PUBLIC_OPENAI_API_KEY.

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  chat(messages: LlmMessage[], opts?: { json?: boolean; webSearch?: boolean }): Promise<string>;
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super('AI is not configured in this build.');
    this.name = 'LlmNotConfiguredError';
  }
}

export function isLlmConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_OPENAI_API_KEY;
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
}

interface ResponsesOutputItem {
  type?: string;
  content?: { type?: string; text?: string }[];
}

/**
 * Chat via the Responses API with the hosted web_search tool, forcing JSON
 * output. Lets the model verify current teams, injuries, and matchups
 * instead of relying on its training cutoff.
 */
async function chatWithWebSearch(key: string, messages: LlmMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_output_tokens: 4000,
      tools: [{ type: 'web_search' }],
      // NOTE: the Responses API rejects web_search combined with a JSON
      // text format ("Web Search cannot be used with JSON mode"), so the
      // model returns plain text and parseRecommendations extracts the JSON.
      input: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI request failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { output?: ResponsesOutputItem[] };
  // With web_search the model can emit several messages (intermediate notes,
  // then the final answer): the LAST message holds the recommendations.
  let text: string | null = null;
  for (const item of data.output ?? []) {
    if (item.type === 'message') {
      const textPart = (item.content ?? []).find((c) => c.type === 'output_text' && c.text);
      if (textPart?.text) {
        text = textPart.text;
      }
    }
  }
  if (!text) {
    throw new Error('AI returned no usable response.');
  }
  return text;
}

/** Returns the default OpenAI provider; throws LlmNotConfiguredError when no key. */
export function getLlmProvider(): LlmProvider {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) {
    throw new LlmNotConfiguredError();
  }
  return {
    async chat(messages: LlmMessage[], opts?: { json?: boolean; webSearch?: boolean }): Promise<string> {
      if (opts?.webSearch) {
        return chatWithWebSearch(key, messages);
      }
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
      });
      if (!res.ok) {
        throw new Error('AI request failed. Please try again.');
      }
      const data = (await res.json()) as OpenAiChatResponse;
      return data.choices?.[0]?.message?.content ?? '';
    },
  };
}

/** System prompt for lineup recommendations. Contracts the LLM to JSON-only output. */
export function buildLineupSystemPrompt(): string {
  return [
    'You are a fantasy football analyst for the Sideline AI app.',
    'Recommend a starting lineup for the given week: concise start/sit picks, each with a 1-2 sentence reason.',
    'Respond with ONLY valid JSON: an object shaped like {"recommendations": [...]}, with one object per roster slot inside the array.',
    'Each object must have: slot (roster slot label, e.g. "QB", "RB1", "FLEX"),',
    'starterId (the Sleeper player id you recommend to start), starterName (player display name),',
    'reasoning (1-2 sentences explaining the pick),',
    'confidence (one of: "high", "medium", "low"),',
    'and alternatives: an array of up to 2 bench options, each with playerId, playerName, and a short note.',
    'Do not include any text outside the JSON object. Never use em dashes in any text field; use commas or colons instead.',
    'The team shown next to each player is their CURRENT team: trust it over your training data, because players change teams every offseason.',
    'Never describe a player as playing for a different team, catching passes from a different quarterback, or facing a specific opponent unless that fact appears in the prompt.',
  ].join(' ');
}

export interface LineupPlayerSummary {
  id: string;
  name: string;
  position?: string;
  team?: string | null;
}

export interface LineupPromptArgs {
  leagueName: string;
  week: number;
  rosterPositions: string[];
  starters: LineupPlayerSummary[];
  bench: LineupPlayerSummary[];
}

function formatPlayer(p: LineupPlayerSummary): string {
  const meta = [p.position, p.team].filter((part) => part !== undefined && part !== null && part !== '').join(', ');
  return meta.length > 0 ? `${p.name} (${meta}) [${p.id}]` : `${p.name} [${p.id}]`;
}

/** User prompt describing the league, week, and current roster for lineup advice. */
export function buildLineupUserPrompt(args: LineupPromptArgs): string {
  const starterLines = args.starters.map((p) => `- ${formatPlayer(p)}`).join('\n');
  const benchLines =
    args.bench.length > 0 ? args.bench.map((p) => `- ${formatPlayer(p)}`).join('\n') : '- (empty bench)';
  return [
    `League: ${args.leagueName}`,
    `Week: ${args.week}`,
    `Roster slots: ${args.rosterPositions.join(', ')}`,
    'Current starters:',
    starterLines,
    'Bench:',
    benchLines,
    'Recommend the optimal starting lineup using ONLY the players listed above.',
  ].join('\n');
}

/** System prompt for free-form fantasy chat, scoped by league context. */
export function buildChatSystemPrompt(leagueContext: string): string {
  return [
    'You are Sideline AI, a concise fantasy football assistant inside the Sideline AI app.',
    'Answer fantasy football questions directly and briefly.',
    'Do not invent players, stats, or matchups; say when you are unsure.',
    'Never use em dashes in your answers; use commas or colons instead.',
    'League context:',
    leagueContext,
  ].join('\n');
}
