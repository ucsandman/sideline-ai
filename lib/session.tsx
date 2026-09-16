// Session context: signed-in Sleeper user, their leagues, and league selection.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { currentSeasonYear, fetchSleeperUser, fetchUserLeagues } from './sleeper';
import { loadSelectedLeagueIds, loadSleeperUser, saveSelectedLeagueIds, saveSleeperUser } from './storage';
import type { SleeperLeague, SleeperUser } from './types';

export interface SessionValue {
  user: SleeperUser | null;
  leagues: SleeperLeague[];
  selectedLeagueIds: string[];
  hydrated: boolean;
  signIn: (username: string) => Promise<void>;
  refreshLeagues: () => Promise<void>;
  toggleLeague: (leagueId: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from storage on mount; refresh leagues from Sleeper when signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedUser, storedIds] = await Promise.all([loadSleeperUser(), loadSelectedLeagueIds()]);
        if (cancelled) return;
        setUser(storedUser);
        setSelectedLeagueIds(storedIds);
        if (storedUser !== null) {
          try {
            const fetched = await fetchUserLeagues(storedUser.user_id, currentSeasonYear());
            if (!cancelled) setLeagues(fetched);
          } catch {
            // Offline or Sleeper hiccup: keep storage-only state, app still renders.
          }
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string): Promise<void> => {
    const trimmed = username.trim();
    const fetchedUser = await fetchSleeperUser(trimmed); // throws on unknown user
    const fetchedLeagues = await fetchUserLeagues(fetchedUser.user_id, currentSeasonYear());
    const ids = fetchedLeagues.map((league) => league.league_id);
    await saveSleeperUser(fetchedUser);
    await saveSelectedLeagueIds(ids);
    setUser(fetchedUser);
    setLeagues(fetchedLeagues);
    setSelectedLeagueIds(ids);
  }, []);

  const refreshLeagues = useCallback(async (): Promise<void> => {
    if (user === null) return;
    const fetched = await fetchUserLeagues(user.user_id, currentSeasonYear());
    setLeagues(fetched);
  }, [user]);

  const toggleLeague = useCallback((leagueId: string): void => {
    setSelectedLeagueIds((prev) => {
      const next = prev.includes(leagueId)
        ? prev.filter((id) => id !== leagueId)
        : [...prev, leagueId];
      void saveSelectedLeagueIds(next);
      return next;
    });
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await saveSleeperUser(null);
    await saveSelectedLeagueIds([]);
    setUser(null);
    setLeagues([]);
    setSelectedLeagueIds([]);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, leagues, selectedLeagueIds, hydrated, signIn, refreshLeagues, toggleLeague, signOut }),
    [user, leagues, selectedLeagueIds, hydrated, signIn, refreshLeagues, toggleLeague, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession must be used within a SessionProvider.');
  }
  return ctx;
}
