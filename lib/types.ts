// Shared data shapes for the Sideline AI app.
// All Sleeper shapes mirror https://api.sleeper.app/v1 responses.

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface NflState {
  season: string;
  week: number;
  season_type: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  starters: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
  };
}

export interface SleeperMatchup {
  matchup_id: number;
  roster_id: number;
  starters: string[];
  players: string[];
  points: number;
}

export interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
  injury_status?: string | null;
}

export interface TrendingPlayer {
  player_id: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

/** Best-effort display name for a Sleeper player record. */
export function playerDisplayName(p: SleeperPlayer | undefined, fallbackId: string): string {
  if (!p) return fallbackId;
  if (p.full_name && p.full_name.trim().length > 0) return p.full_name;
  const first = p.first_name?.trim() ?? '';
  const last = p.last_name?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  return combined.length > 0 ? combined : fallbackId;
}
