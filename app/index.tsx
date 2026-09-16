import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/session';
import type { SleeperLeague } from '../lib/types';
import { LoadingView } from '../components/LoadingView';

export default function Onboarding() {
  const {
    hydrated,
    user,
    leagues,
    selectedLeagueIds,
    signIn,
    toggleLeague,
    signOut,
  } = useSession();
  const [username, setUsername] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) {
    return <LoadingView />;
  }

  if (user) {
    if (leagues.length === 0) {
      return <LoadingView label="Finding your leagues..." />;
    }
    if (selectedLeagueIds.length > 0) {
      return <Redirect href="/(tabs)/dashboard" />;
    }
    return (
      <LeaguePicker
        leagues={leagues}
        selectedLeagueIds={selectedLeagueIds}
        onToggle={toggleLeague}
        onBack={async () => {
          await signOut();
        }}
      />
    );
  }

  const handleSignIn = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Enter your Sleeper username.');
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      await signIn(trimmed);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not find that Sleeper user.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Sideline AI</Text>
        <Text style={styles.subtitle}>
          Your AI co-pilot for fantasy football. Sign in with Sleeper to get
          started.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Sleeper username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          onSubmitEditing={handleSignIn}
          returnKeyType="go"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, signingIn && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={signingIn}
        >
          <Text style={styles.buttonText}>
            {signingIn ? 'Finding leagues...' : 'Find my leagues'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function LeaguePicker({
  leagues,
  selectedLeagueIds,
  onToggle,
  onBack,
}: {
  leagues: SleeperLeague[];
  selectedLeagueIds: string[];
  onToggle: (leagueId: string) => void;
  onBack: () => void;
}) {
  const canContinue = selectedLeagueIds.length > 0;

  const renderItem = ({ item }: { item: SleeperLeague }) => {
    const selected = selectedLeagueIds.includes(item.league_id);
    return (
      <Pressable style={styles.leagueRow} onPress={() => onToggle(item.league_id)}>
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <View style={styles.leagueInfo}>
          <Text style={styles.leagueName}>{item.name}</Text>
          <Text style={styles.leagueSeason}>{item.season} season</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Pick your leagues</Text>
        <Text style={styles.subtitle}>
          Choose which leagues Sideline AI should track.
        </Text>
        {leagues.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.error}>
              No Sleeper leagues found for this username.
            </Text>
            <Pressable style={styles.button} onPress={onBack}>
              <Text style={styles.buttonText}>Try another username</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <FlatList
              data={leagues}
              keyExtractor={(item) => item.league_id}
              renderItem={renderItem}
              style={styles.list}
            />
            <Pressable
              style={[styles.button, !canContinue && styles.buttonDisabled]}
              onPress={() => router.replace('/(tabs)/dashboard')}
              disabled={!canContinue}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={onBack}>
              <Text style={styles.linkText}>Use a different account</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#0B1F3A',
    borderRadius: 12,
    marginTop: 16,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#94A3B8',
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginRight: 12,
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: '#0B1F3A',
    borderColor: '#0B1F3A',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  emptyBox: {
    alignItems: 'center',
    marginTop: 32,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  leagueRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 14,
  },
  leagueSeason: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  linkText: {
    color: '#0B1F3A',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    marginTop: 16,
  },
  safe: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  subtitle: {
    color: '#475569',
    fontSize: 15,
    marginTop: 8,
  },
  title: {
    color: '#0B1F3A',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 32,
  },
});
