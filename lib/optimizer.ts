// Lineup optimizer: LLM recommendations when configured, heuristic fallback otherwise.
// Never throws for a missing API key; the fallback keeps current starters.

import {
  buildLineupSystemPrompt,
  buildLineupUserPrompt,
  getLlmProvider,
  isLlmConfigured,
} from './llm';
import type { LineupPlayerSummary } from './llm';
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from './types';
import { playerDisplayName } from './types';

export interface LineupRecommendation {
  slot: string;
  starterId: string;
  starterName: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  alternatives: { playerId: string; playerName: string; note: string }[];
}

export interface OptimizeInput {
  league: SleeperLeague;
  roster: SleeperRoster;
  players: Record<string, SleeperPlayer>;
  week: number;
}

const FALLBACK_REASONING = 'AI projections are unavailable in this build, keeping your current starters.';

function summarize(id: string, players: Record<string, SleeperPlayer>): LineupPlayerSummary {
  const p = players[id];
  return {
    id,
    name: playerDisplayName(p, id),
    position: p?.position,
    team: p?.team,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const CONFIDENCES = new Set(['high', 'medium', 'low']);

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  // The model often emits numeric Sleeper ids (e.g. "starterId": 6804).
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Pick the first present string among candidate keys (handles snake/camel variants). */
function pickString(rec: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = asString(rec[k]);
    if (v !== null) return v;
  }
  return null;
}

/** Normalize one raw item into a LineupRecommendation, or null if unusable. */
function normalizeRecommendation(value: unknown): LineupRecommendation | null {
  if (!isRecord(value)) return null;
  const slot = pickString(value, ['slot', 'position', 'slotLabel']);
  const starterId = pickString(value, ['starterId', 'starter_id', 'playerId', 'player_id', 'id']);
  const starterName = pickString(value, ['starterName', 'starter_name', 'name', 'playerName', 'player_name']);
  const reasoning = pickString(value, ['reasoning', 'reason', 'note', 'explanation']);
  if (!slot || !starterId || !starterName || !reasoning) return null;
  const rawConfidence = pickString(value, ['confidence']);
  const confidence = rawConfidence !== null && CONFIDENCES.has(rawConfidence.toLowerCase())
    ? (rawConfidence.toLowerCase() as LineupRecommendation['confidence'])
    : 'medium';
  const rawAlts = value.alternatives ?? value.bench_options ?? value.benchOptions;
  const alternatives = Array.isArray(rawAlts)
    ? rawAlts
        .filter(
          (alt): alt is { playerId: string; playerName: string; note: string } =>
            isRecord(alt) &&
            pickString(alt, ['playerId', 'player_id', 'id']) !== null &&
            pickString(alt, ['playerName', 'player_name', 'name']) !== null &&
            pickString(alt, ['note', 'reason', 'reasoning']) !== null,
        )
        .map((alt) => ({
          playerId: pickString(alt as Record<string, unknown>, ['playerId', 'player_id', 'id']) as string,
          playerName: pickString(alt as Record<string, unknown>, ['playerName', 'player_name', 'name']) as string,
          note: pickString(alt as Record<string, unknown>, ['note', 'reason', 'reasoning']) as string,
        }))
    : [];
  return { slot, starterId, starterName, reasoning, confidence, alternatives };
}

/** Parse the model's JSON output, tolerating wrappers, fences, and stray text. */
function parseRecommendations(raw: string): LineupRecommendation[] {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`AI returned an unexpected response format. Raw: ${raw.slice(0, 400)}`);
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  const arr: unknown = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed)
      ? ['recommendations', 'lineup', 'picks', 'slots']
          .map((k) => (parsed as Record<string, unknown>)[k])
          .find((v) => Array.isArray(v))
      : undefined;
  if (!Array.isArray(arr)) {
    throw new Error(`AI returned an unexpected response format. Raw: ${raw.slice(0, 400)}`);
  }
  const recs = arr
    .map(normalizeRecommendation)
    .filter((r): r is LineupRecommendation => r !== null);
  if (recs.length === 0) {
    throw new Error(`AI returned an unexpected response format. Raw: ${raw.slice(0, 400)}`);
  }
  return recs;
}

/** Heuristic fallback when no LLM key is configured: keep current starters. */
function heuristicRecommendations(input: OptimizeInput): LineupRecommendation[] {
  const starters = input.roster.starters ?? [];
  const slots = input.league.roster_positions.filter((pos) => pos !== 'BN');
  return starters.map((id, index) => ({
    slot: slots[index] ?? `FLEX${index + 1}`,
    starterId: id,
    starterName: playerDisplayName(input.players[id], id),
    reasoning: FALLBACK_REASONING,
    confidence: 'low' as const,
    alternatives: [],
  }));
}

export async function recommendLineup(input: OptimizeInput): Promise<LineupRecommendation[]> {
  if (!isLlmConfigured()) {
    return heuristicRecommendations(input);
  }

  const starters = input.roster.starters ?? [];
  const bench = (input.roster.players ?? []).filter((id) => !starters.includes(id));

  const messages = [
    { role: 'system' as const, content: buildLineupSystemPrompt() },
    {
      role: 'user' as const,
      content: buildLineupUserPrompt({
        leagueName: input.league.name,
        week: input.week,
        rosterPositions: input.league.roster_positions,
        starters: starters.map((id) => summarize(id, input.players)),
        bench: bench.map((id) => summarize(id, input.players)),
      }),
    },
  ];

  const response = await getLlmProvider().chat(messages, { json: true });
  return parseRecommendations(response);
}
