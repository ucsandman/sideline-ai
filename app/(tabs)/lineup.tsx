import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/session';
import { ProGate } from '../../lib/revenuecat';
import {
  fetchAllPlayers,
  fetchLeagueRosters,
  fetchNflState,
} from '../../lib/sleeper';
import { isLlmConfigured } from '../../lib/llm';
import { recommendLineup } from '../../lib/optimizer';
import type { LineupRecommendation } from '../../lib/optimizer';
import { LoadingView } from '../../components/LoadingView';
import { ErrorView } from '../../components/ErrorView';

const CONFIDENCE_COLORS: Record<LineupRecommendation['confidence'], string> = {
  high: '#15803D',
  low: '#B91C1C',
  medium: '#B45309',
};

export default function Lineup() {
  const { user, leagues, selectedLeagueIds } = useSession();
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [recs, setRecs] = useState<LineupRecommendation[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyRoster, setEmptyRoster] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const activeLeagueId = leagueId ?? selectedLeagueIds[0] ?? null;
  const league = leagues.find((l) => l.league_id === activeLeagueId) ?? null;
  const showSelector = selectedLeagueIds.length > 1;

  const optimize = useCallback(async () => {
    if (!league || !user) return;
    setOptimizing(true);
    setError(null);
    setEmptyRoster(false);
    try {
      const state = await fetchNflState();
      const rosters = await fetchLeagueRosters(league.league_id);
      const mine = rosters.find((r) => r.owner_id === user.user_id);
      if (!mine || !mine.players || mine.players.length === 0) {
        setEmptyRoster(true);
        setRecs([]);
        setHasRun(true);
        return;
      }
      const players = await fetchAllPlayers();
      const result = await recommendLineup({
        league,
        players,
        roster: mine,
        week: state.week,
      });
      setRecs(result);
      setHasRun(true);
    } catch {
      setError('Could not optimize your lineup. Try again.');
    } finally {
      setOptimizing(false);
    }
  }, [league, user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lineup Optimizer</Text>
      </View>
      <ProGate
        lockedTitle="Pro feature"
        lockedBody="The AI lineup optimizer is a Pro feature. Upgrade to get start/sit calls every week."
      >
        <View style={styles.body}>
          {showSelector ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selector}
            >
              {selectedLeagueIds.map((id) => {
                const l = leagues.find((x) => x.league_id === id);
                const active = id === activeLeagueId;
                return (
                  <Pressable
                    key={id}
                    style={[styles.leagueButton, active && styles.leagueButtonActive]}
                    onPress={() => setLeagueId(id)}
                  >
                    <Text
                      style={[
                        styles.leagueButtonText,
                        active && styles.leagueButtonTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {l?.name ?? 'League'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {!isLlmConfigured() ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                AI projections are unavailable in this build. Showing your
                current starters.
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, optimizing && styles.buttonDisabled]}
            onPress={() => void optimize()}
            disabled={optimizing || !league}
          >
            <Text style={styles.buttonText}>
              {optimizing ? 'Optimizing...' : 'Optimize my lineup'}
            </Text>
          </Pressable>

          {optimizing ? (
            <LoadingView label="Crunching the numbers..." />
          ) : error ? (
            <ErrorView message={error} onRetry={() => void optimize()} />
          ) : emptyRoster ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Your roster is empty in this league, nothing to optimize yet.
              </Text>
            </View>
          ) : hasRun && recs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No lineup recommendations came back. Try again.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {recs.map((rec) => (
                <View key={`${rec.slot}-${rec.starterId}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.slot}>{rec.slot}</Text>
                    <Text
                      style={[
                        styles.badge,
                        { color: CONFIDENCE_COLORS[rec.confidence] },
                      ]}
                    >
                      {rec.confidence}
                    </Text>
                  </View>
                  <Text style={styles.starter}>{rec.starterName}</Text>
                  <Text style={styles.reasoning}>{rec.reasoning}</Text>
                  {rec.alternatives.length > 0 ? (
                    <View style={styles.alts}>
                      <Text style={styles.altsTitle}>Alternatives</Text>
                      {rec.alternatives.map((alt) => (
                        <Text key={alt.playerId} style={styles.alt}>
                          {alt.playerName} ({alt.note})
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ProGate>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  alt: {
    color: '#475569',
    fontSize: 13,
    marginTop: 2,
  },
  alts: {
    marginTop: 10,
  },
  altsTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  banner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  bannerText: {
    color: '#92400E',
    fontSize: 13,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0B1F3A',
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  leagueButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
    marginRight: 8,
    maxWidth: 180,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leagueButtonActive: {
    backgroundColor: '#0B1F3A',
  },
  leagueButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  leagueButtonTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingVertical: 12,
  },
  reasoning: {
    color: '#475569',
    fontSize: 14,
    marginTop: 6,
  },
  safe: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  selector: {
    paddingVertical: 8,
  },
  slot: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  starter: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  title: {
    color: '#0B1F3A',
    fontSize: 26,
    fontWeight: '700',
  },
});
