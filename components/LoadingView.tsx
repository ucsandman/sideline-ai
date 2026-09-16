import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#0B1F3A" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
  label: {
    color: '#475569',
    fontSize: 14,
    marginTop: 12,
  },
});
