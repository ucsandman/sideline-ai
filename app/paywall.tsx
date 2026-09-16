import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRevenueCat } from '../lib/revenuecat';

const FEATURES = [
  'Unlimited AI chat with your teams',
  'AI lineup optimizer every week',
  'Cancel anytime',
];

export default function Paywall(): React.JSX.Element {
  const router = useRouter();
  const {
    monthlyPackage,
    seasonalPackage,
    purchaseMonthly,
    purchaseSeasonal,
    restore,
    error,
  } = useRevenueCat();
  const [busy, setBusy] = useState<'monthly' | 'seasonal' | 'restore' | null>(null);

  const noPlans = monthlyPackage === null && seasonalPackage === null;

  const run = async (kind: 'monthly' | 'seasonal') => {
    setBusy(kind);
    try {
      const ok = kind === 'monthly' ? await purchaseMonthly() : await purchaseSeasonal();
      if (ok) {
        router.back();
      }
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async () => {
    setBusy('restore');
    try {
      await restore();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={12}>
          <Text style={styles.close}>X</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sideline AI Pro</Text>
        <Text style={styles.subtitle}>Your AI edge for every snap, every week.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.feature}>{f}</Text>
            </View>
          ))}
        </View>

        {noPlans && (
          <Text style={styles.notice}>Plans are unavailable in this build.</Text>
        )}

        <Pressable
          style={[styles.planButton, styles.monthlyButton, busy === 'monthly' && styles.disabled]}
          onPress={() => run('monthly')}
          disabled={busy !== null}
        >
          {busy === 'monthly' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.planLabel}>Monthly</Text>
              <Text style={styles.planPrice}>
                {monthlyPackage?.product.priceString ?? '$4.99/month'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.planButton, styles.seasonButton, busy === 'seasonal' && styles.disabled]}
          onPress={() => run('seasonal')}
          disabled={busy !== null}
        >
          {busy === 'seasonal' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.planLabel}>Season</Text>
              <Text style={styles.planPrice}>
                {seasonalPackage?.product.priceString ?? '$29.99/season'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={runRestore} disabled={busy !== null} style={styles.restoreButton}>
          {busy === 'restore' ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.restoreText}>Restore purchases</Text>
          )}
        </Pressable>

        {error !== null && error.length > 0 && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.smallPrint}>
          Payment is charged through your app store account. Manage or cancel in your store settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  check: {
    color: '#16a34a',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 10,
  },
  close: {
    fontSize: 22,
    fontWeight: '700',
    padding: 8,
  },
  content: {
    alignItems: 'stretch',
    padding: 24,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: '#dc2626',
    marginTop: 12,
    textAlign: 'center',
  },
  feature: {
    flex: 1,
    fontSize: 16,
  },
  featureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 6,
  },
  features: {
    marginVertical: 16,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  monthlyButton: {
    backgroundColor: '#1d4ed8',
  },
  notice: {
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  planButton: {
    alignItems: 'center',
    borderRadius: 12,
    marginVertical: 6,
    paddingVertical: 14,
  },
  planLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  planPrice: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  restoreButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  restoreText: {
    color: '#1d4ed8',
    fontSize: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  safe: {
    flex: 1,
  },
  seasonButton: {
    backgroundColor: '#0f766e',
  },
  smallPrint: {
    color: '#888',
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    color: '#555',
    fontSize: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
});
