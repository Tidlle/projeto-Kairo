import { StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

type ProgressBarProps = {
  /** 0–100. Valores fora da faixa são grampeados, nunca estouram a barra. */
  percent: number;
};

export function ProgressBar({ percent }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <ThemedView type="backgroundSelected" style={styles.track}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: theme.accent }]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  track: {
    height: Spacing.one,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Spacing.one,
  },
});
