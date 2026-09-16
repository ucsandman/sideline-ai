import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../../lib/session';
import {
  fetchAllPlayers,
  fetchLeagueRosters,
  fetchTrendingPlayers,
} from '../../lib/sleeper';
import { playerDisplayName } from '../../lib/types';
import type { SleeperPlayer } from '../../lib/types';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';
import { PlayerRow } from '../../components/PlayerRow';

type TrendingAdd = Awaited<ReturnType<typeof fetchTrendingPlayers>>[number];

type WaiverTarget = {
  playerId: string;
  name: string;
  position: string;
  team: string;
  adds: number;
};

export default function Waiver() {
  const { selectedLeagueIds } = useSession();
  const [targets, setTargets] = useState<WaiverTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const [trending, players] = await Promise.all([
          fetchTrendingPlayers('add', 24, 25),
          fetchAllPlayers(),
        ]);
        const rostered = new Set<string>();
        for (const leagueId of selectedLeagueIds) {
          const rosters = await fetchLeagueRosters(leagueId);
          for (const roster of rosters) {
            for (const id of roster.players ?? []) {
              rostered.add(id);
            }
          }
        }
        const next: WaiverTarget[] = [];
        for (const t of trending as TrendingAdd[]) {
          const playerId: string = t.player_id;
          if (rostered.has(playerId)) continue;
          const p: SleeperPlayer | undefined = players[playerId];
          if (!p) continue;
          next.push({
            adds: t.count,
            name: playerDisplayName(p, playerId),
            playerId,
            position: p.position ?? 'N/A',
            team: p.team ?? 'FA',
          });
        }
        setTargets(next);
      } catch {
        setError('Could not load the waiver wire. Pull to retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedLeagueIds],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  if (loading && targets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Waiver Wire</Text>
        </View>
        <LoadingView label="Checking trending players..." />
      </SafeAreaView>
    );
  }

  if (error && targets.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Waiver Wire</Text>
        </View>
        <ErrorView message={error} onRetry={() => void load(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Waiver Wire</Text>
        <Text style={styles.note}>Trending adds in the last 24 hours</Text>
      </View>
      <FlatList
        data={targets}
        keyExtractor={(item) => item.playerId}
        renderItem={({ item }) => (
          <PlayerRow
            name={item.name}
            meta={`${item.position} · ${item.team}`}
            right={<Text style={styles.adds}>{item.adds} adds</Text>}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No trending free agents right now. Check back later.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  adds: {
    color: '#0B1F3A',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  note: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 2,
  },
  safe: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  title: {
    color: '#0B1F3A',
    fontSize: 26,
    fontWeight: '700',
  },
});
