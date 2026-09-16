import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { useRevenueCat } from '../../lib/revenuecat';
import { LoadingView } from '../../components/LoadingView';

export default function Settings() {
  const { user, signOut } = useSession();
  const { isPro, restore, unlockProDev } = useRevenueCat();
  const [restoring, setRestoring] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restore();
      Alert.alert('Done', 'Purchases restored.');
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleSwitchUser = () => {
    Alert.alert(
      'Switch Sleeper user?',
      'This signs you out of Sideline AI. You will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void signOut()
              .catch(() => {
                // still navigate home on failure
              })
              .finally(() => {
                router.replace('/');
              });
          },
        },
      ],
    );
  };

  if (signingOut) {
    return <LoadingView label="Signing out..." />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Sleeper account</Text>
          <Text style={styles.value}>
            Signed in as {user?.username ?? 'Unknown'}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>
            {isPro ? 'Sideline AI Pro' : 'Free'}
          </Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => router.push('/paywall')}
        >
          <Text style={styles.buttonText}>Manage subscription</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton, restoring && styles.buttonDisabled]}
          onPress={() => void handleRestore()}
          disabled={restoring}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            {restoring ? 'Restoring...' : 'Restore purchases'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.dangerButton]}
          onPress={handleSwitchUser}
        >
          <Text style={[styles.buttonText, styles.dangerButtonText]}>
            Switch Sleeper user
          </Text>
        </Pressable>

        {__DEV__ && !isPro && (
          <Pressable style={[styles.button, styles.devButton]} onPress={unlockProDev}>
            <Text style={styles.buttonText}>Unlock Pro (dev testing)</Text>
          </Pressable>
        )}

        <Text style={styles.footer}>Sideline AI v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
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
  dangerButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  dangerButtonText: {
    color: '#B91C1C',
  },
  devButton: {
    backgroundColor: '#6D28D9',
  },
  footer: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 32,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  safe: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#0B1F3A',
  },
  title: {
    color: '#0B1F3A',
    fontSize: 26,
    fontWeight: '700',
  },
  value: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});
