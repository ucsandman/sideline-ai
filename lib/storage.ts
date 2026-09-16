// Persistent local state: signed-in user, league selection, weekly chat usage.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SleeperUser } from './types';

const USER_KEY = 'sideline:user';
const LEAGUE_IDS_KEY = 'sideline:leagueIds';
const CHAT_USAGE_PREFIX = 'sideline:chat:';

/** Free AI chat messages per ISO week for non-subscribed users. */
export const FREE_CHAT_PER_WEEK = 3;

export async function saveSleeperUser(user: SleeperUser | null): Promise<void> {
  if (user === null) {
    await AsyncStorage.removeItem(USER_KEY);
  } else {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export async function loadSleeperUser(): Promise<SleeperUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as SleeperUser;
  } catch {
    return null;
  }
}

export async function saveSelectedLeagueIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(LEAGUE_IDS_KEY, JSON.stringify(ids));
}

export async function loadSelectedLeagueIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(LEAGUE_IDS_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** ISO week key like "2026-W38" based on local date. */
export function currentWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // shift to Thursday of this ISO week
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export async function getChatUsage(weekKey: string): Promise<number> {
  const raw = await AsyncStorage.getItem(`${CHAT_USAGE_PREFIX}${weekKey}`);
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function incrementChatUsage(weekKey: string): Promise<number> {
  const next = (await getChatUsage(weekKey)) + 1;
  await AsyncStorage.setItem(`${CHAT_USAGE_PREFIX}${weekKey}`, String(next));
  return next;
}
