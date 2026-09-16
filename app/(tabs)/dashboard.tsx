import { useCallback, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../../lib/session';
import {
  fetchLeagueMatchups,
  fetchLeagueRosters,
  fetchNflState,
} from '../../lib/sleeper';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';

type TeamCard = {
  leagueId: string;
  leagueName: string;
  record: string;
  week: number;
  myPoints: number | null;
  oppPoints: number | null;
  oppOwnerId: string | null;
};

function formatPoints(points: number | null): string {
  if (points === null || points === undefined) return '--';
  return points.toFixed(1);
}

async function fetchDisplayName(ownerId: string): Promise<string> {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/user/${ownerId}`);
    if (!res.ok) return 'Unknown manager';
    const data: unknown = await res.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      'display_name' in data &&
      typeof (data as { display_name: unknown }).display_name === 'string'
    ) {
      const name = (data as { display_name: string }).display_name;
      return name || 'Unknown manager';
    }
    return 'Unknown manager';
  } catch {
    return 'Unknown manager';
  }
}

export default function Dashboard() {
  const { user, leagues, selectedLeagueIds } = useSession();
  const [cards, setCards] = useState<TeamCard[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedNames = useRef<Set<string>>(new Set());

  const ensureName = useCallback(async (ownerId: string) => {
    if (!ownerId || fetchedNames.current.has(ownerId)) return;
    fetchedNames.current.add(ownerId);
    const name = await fetchDisplayName(ownerId);
    setNames((prev) => ({ ...prev, [ownerId]: name }));
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const state = await fetchNflState();
        const next: TeamCard[] = [];
        for (const leagueId of selectedLeagueIds) {
          const league = leagues.find((l) => l.league_id === leagueId);
          if (!league) continue;
          const rosters = await fetchLeagueRosters(leagueId);
          const mine = rosters.find((r) => r.owner_id === user.user_id);
          if (!mine) continue;
          const matchups = await fetchLeagueMatchups(leagueId, state.week);
          const myEntry = matchups.find((m) => m.roster_id === mine.roster_id);
          const oppEntry = myEntry
            ? matchups.find(
                (m) =>
                  m.matchup_id === myEntry.matchup_id &&
                  m.roster_id !== mine.roster_id,
              )
            : undefined;
          const oppRoster = oppEntry
            ? rosters.find((r) => r.roster_id === oppEntry.roster_id)
            : undefined;
          const wins = mine.settings?.wins ?? 0;
          const losses = mine.settings?.losses ?? 0;
          const ties = mine.settings?.ties ?? 0;
          next.push({
            leagueId,
            leagueName: league.name,
            myPoints: myEntry?.points ?? null,
            oppOwnerId: oppRoster?.owner_id ?? null,
            oppPoints: oppEntry?.points ?? null,
            record: ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`,
            week: state.week,
          });
        }
        setCards(next);
        for (const card of next) {
          if (card.oppOwnerId) {
            void ensureName(card.oppOwnerId);
          }
        }
      } catch {
        setError('Could not load your teams. Pull to retry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, leagues, selectedLeagueIds, ensureName],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const renderContent = () => {
    if (loading && cards.length === 0) {
      return <LoadingView label="Loading your teams..." />;
    }
    if (error && cards.length === 0) {
      return <ErrorView message={error} onRetry={() => void load(false)} />;
    }
    if (selectedLeagueIds.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No leagues selected. Sign in again to pick your leagues.
          </Text>
        </View>
      );
    }
    if (cards.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No teams found in your selected leagues.
          </Text>
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        {cards.map((card) => (
          <View key={card.leagueId} style={styles.card}>
            <Text style={styles.leagueName}>{card.leagueName}</Text>
            <Text style={styles.record}>Record: {card.record}</Text>
            <View style={styles.matchup}>
              <Text style={styles.week}>Week {card.week}</Text>
              <Text style={styles.scoreLine}>
                You {formatPoints(card.myPoints)} vs{' '}
                {card.oppOwnerId
                  ? `${names[card.oppOwnerId] ?? 'Opponent'} ${formatPoints(card.oppPoints)}`
                  : 'BYE'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Teams</Text>
      </View>
      <View style={styles.body}>{renderContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  emptyBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
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
  leagueName: {
    color: '#0B1F3A',
    fontSize: 17,
    fontWeight: '700',
  },
  list: {
    padding: 16,
  },
  matchup: {
    marginTop: 10,
  },
  record: {
    color: '#475569',
    fontSize: 14,
    marginTop: 4,
  },
  safe: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  scoreLine: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  title: {
    color: '#0B1F3A',
    fontSize: 26,
    fontWeight: '700',
  },
  week: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
