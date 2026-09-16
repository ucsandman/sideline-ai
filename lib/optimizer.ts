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

function isValidRecommendation(value: unknown): value is LineupRecommendation {
  if (!isRecord(value)) return false;
  if (typeof value.slot !== 'string' || typeof value.starterId !== 'string') return false;
  if (typeof value.starterName !== 'string' || typeof value.reasoning !== 'string') return false;
  if (typeof value.confidence !== 'string' || !CONFIDENCES.has(value.confidence)) return false;
  if (value.alternatives !== undefined && !Array.isArray(value.alternatives)) return false;
  return true;
}

/** Parse the model's JSON-only output, tolerating stray text around the array. */
function parseRecommendations(raw: string): LineupRecommendation[] {
  let text = raw.trim();
  if (!text.startsWith('[')) {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI returned an unexpected response format.');
    }
    text = text.slice(start, end + 1);
  }
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isValidRecommendation)) {
    throw new Error('AI returned an unexpected response format.');
  }
  return parsed.map((rec) => ({
    slot: rec.slot,
    starterId: rec.starterId,
    starterName: rec.starterName,
    reasoning: rec.reasoning,
    confidence: rec.confidence,
    alternatives: Array.isArray(rec.alternatives)
      ? rec.alternatives
          .filter(
            (alt): alt is { playerId: string; playerName: string; note: string } =>
              isRecord(alt) &&
              typeof alt.playerId === 'string' &&
              typeof alt.playerName === 'string' &&
              typeof alt.note === 'string',
          )
          .map((alt) => ({ playerId: alt.playerId, playerName: alt.playerName, note: alt.note }))
      : [],
  }));
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

  const response = await getLlmProvider().chat(messages);
  return parseRecommendations(response);
}
