import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Button, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

export const PRO_ENTITLEMENT = 'pro';

export interface RevenueCatValue {
  ready: boolean;
  isPro: boolean;
  monthlyPackage: PurchasesPackage | null;
  seasonalPackage: PurchasesPackage | null;
  purchaseMonthly: () => Promise<boolean>;
  purchaseSeasonal: () => Promise<boolean>;
  restore: () => Promise<void>;
  /** Dev-only: flip Pro on for local testing. No-op in production builds. */
  unlockProDev: () => void;
  error: string | null;
}

const RevenueCatContext = createContext<RevenueCatValue | null>(null);

function apiKeyForPlatform(): string | undefined {
  const key =
    Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
  return key && key.trim().length > 0 ? key : undefined;
}

async function refreshState(
  setIsPro: (v: boolean) => void,
  setMonthlyPackage: (p: PurchasesPackage | null) => void,
  setSeasonalPackage: (p: PurchasesPackage | null) => void,
): Promise<void> {
  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);
  setIsPro(customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined);
  const pkgs = offerings.current?.availablePackages ?? [];
  setMonthlyPackage(pkgs.find((p) => p.packageType === 'MONTHLY') ?? null);
  setSeasonalPackage(
    pkgs.find((p) => p.identifier.toLowerCase().includes('season')) ??
      pkgs.find((p) => p.packageType === 'CUSTOM' || p.packageType === 'UNKNOWN') ??
      null,
  );
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Dev-only escape hatch for local testing: set EXPO_PUBLIC_BYPASS_PAYWALL=true
  // in .env to unlock Pro features without a RevenueCat account. __DEV__ is
  // false in production builds, so this can never leak into a release.
  const bypassPaywall = __DEV__ && process.env.EXPO_PUBLIC_BYPASS_PAYWALL === 'true';
  const [ready, setReady] = useState(() => bypassPaywall || !apiKeyForPlatform());
  const [isPro, setIsPro] = useState(bypassPaywall);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [seasonalPackage, setSeasonalPackage] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(() =>
    apiKeyForPlatform()
      ? null
      : 'RevenueCat key is not configured. Add EXPO_PUBLIC_REVENUECAT_APPLE_KEY to your build.',
  );

  useEffect(() => {
    let cancelled = false;
    const key = apiKeyForPlatform();

    if (bypassPaywall) {
      return;
    }

    const customerInfoListener = (info: { entitlements: { active: Record<string, unknown> } }) => {
      if (!cancelled) {
        setIsPro(info.entitlements.active[PRO_ENTITLEMENT] !== undefined);
      }
    };

    if (!key) {
      return;
    }

    const init = async () => {
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }
        await Purchases.configure({ apiKey: key });
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);
        if (cancelled) {
          Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
          return;
        }
        await refreshState(setIsPro, setMonthlyPackage, setSeasonalPackage);
        if (!cancelled) {
          setError(null);
          setReady(true);
        } else {
          Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to initialize RevenueCat.');
          setReady(true);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, [bypassPaywall]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage | null): Promise<boolean> => {
      if (!pkg) {
        return false;
      }
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
      } catch (e) {
        const maybeCancelled = e as { userCancelled?: boolean } | null;
        if (maybeCancelled?.userCancelled === true) {
          return false;
        }
        setError(e instanceof Error ? e.message : 'Purchase failed.');
        return false;
      } finally {
        try {
          await refreshState(setIsPro, setMonthlyPackage, setSeasonalPackage);
        } catch {
          // best-effort refresh after purchase
        }
      }
    },
    [],
  );

  const purchaseMonthly = useCallback(() => purchase(monthlyPackage), [purchase, monthlyPackage]);
  const purchaseSeasonal = useCallback(
    () => purchase(seasonalPackage),
    [purchase, seasonalPackage],
  );

  const restore = useCallback(async (): Promise<void> => {
    try {
      await Purchases.restorePurchases();
      await refreshState(setIsPro, setMonthlyPackage, setSeasonalPackage);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    }
  }, []);

  const unlockProDev = useCallback(() => {
    if (__DEV__) {
      setIsPro(true);
    }
  }, []);

  const value = useMemo<RevenueCatValue>(
    () => ({
      ready,
      isPro,
      monthlyPackage,
      seasonalPackage,
      purchaseMonthly,
      purchaseSeasonal,
      restore,
      unlockProDev,
      error,
    }),
    [ready, isPro, monthlyPackage, seasonalPackage, purchaseMonthly, purchaseSeasonal, restore, unlockProDev, error],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatValue {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error('useRevenueCat must be used inside <RevenueCatProvider>.');
  }
  return ctx;
}

export function ProGate({
  children,
  lockedTitle,
  lockedBody,
}: {
  children: React.ReactNode;
  lockedTitle?: string;
  lockedBody?: string;
}): React.JSX.Element {
  const { ready, isPro } = useRevenueCat();
  const router = useRouter();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.lockedTitle}>{lockedTitle ?? 'Pro feature'}</Text>
      <Text style={styles.lockedBody}>
        {lockedBody ?? 'Upgrade to Sideline AI Pro to unlock this.'}
      </Text>
      <Button title="View plans" onPress={() => router.push('/paywall')} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  lockedBody: {
    color: '#555',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
});
