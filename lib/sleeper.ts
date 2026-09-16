// Thin client for the Sleeper public API (no auth, keep requests minimal).
// https://api.sleeper.app/v1

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  NflState,
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
  TrendingPlayer,
} from './types';

const BASE_URL = 'https://api.sleeper.app/v1';

const PLAYERS_CACHE_KEY = 'sideline:players:v1';
const PLAYERS_CACHE_TS_KEY = 'sideline:players:v1:ts';
const PLAYERS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Throw a friendly Error when a Sleeper response is not OK. */
async function check(res: Response): Promise<void> {
  if (!res.ok) {
    throw new Error('Sleeper request failed. Check your connection and try again.');
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  await check(res);
  return (await res.json()) as T;
}

export async function fetchSleeperUser(username: string): Promise<SleeperUser> {
  const res = await fetch(`${BASE_URL}/user/${encodeURIComponent(username)}`);
  if (res.status === 404) {
    throw new Error('Sleeper user not found. Check the username and try again.');
  }
  await check(res);
  return (await res.json()) as SleeperUser;
}

export async function fetchUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  return getJson<SleeperLeague[]>(`/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`);
}

export async function fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return getJson<SleeperRoster[]>(`/league/${encodeURIComponent(leagueId)}/rosters`);
}

export async function fetchLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return getJson<SleeperMatchup[]>(`/league/${encodeURIComponent(leagueId)}/matchups/${week}`);
}

export async function fetchNflState(): Promise<NflState> {
  return getJson<NflState>('/state/nfl');
}

/**
 * Full NFL player dictionary (~5MB). Cached in AsyncStorage for 24h.
 * A corrupt cache entry triggers a refetch rather than a crash.
 */
export async function fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  try {
    const entries = await AsyncStorage.multiGet([PLAYERS_CACHE_KEY, PLAYERS_CACHE_TS_KEY]);
    const cached = entries[0]?.[1] ?? null;
    const tsRaw = entries[1]?.[1] ?? null;
    const age = tsRaw !== null ? Date.now() - Number(tsRaw) : Number.POSITIVE_INFINITY;
    if (cached !== null && Number.isFinite(age) && age < PLAYERS_CACHE_MAX_AGE_MS) {
      try {
        return JSON.parse(cached) as Record<string, SleeperPlayer>;
      } catch {
        // Corrupt cache: fall through to refetch.
      }
    }
  } catch {
    // Cache read failure: fall through to refetch.
  }

  const res = await fetch(`${BASE_URL}/players/nfl`);
  await check(res);
  const players = (await res.json()) as Record<string, SleeperPlayer>;

  try {
    await AsyncStorage.multiSet([
      [PLAYERS_CACHE_KEY, JSON.stringify(players)],
      [PLAYERS_CACHE_TS_KEY, String(Date.now())],
    ]);
  } catch {
    // Cache write failure is non-fatal; the data is still returned.
  }

  return players;
}

export async function fetchTrendingPlayers(
  kind: 'add' | 'drop',
  lookbackHours = 24,
  limit = 25,
): Promise<TrendingPlayer[]> {
  return getJson<TrendingPlayer[]>(
    `/players/nfl/trending/${kind}?lookback_hours=${lookbackHours}&limit=${limit}`,
  );
}

export function currentSeasonYear(): string {
  return new Date().getFullYear().toString();
}
