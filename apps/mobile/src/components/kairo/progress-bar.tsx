import { StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Cor de destaque do produto — enquanto packages/ui não existe, mora aqui.
// Quando o design system nascer, isso vira um token compartilhado.
const ACCENT = '#3c87f7';

type ProgressBarProps = {
  /** 0–100. Valores fora da faixa são grampeados, nunca estouram a barra. */
  percent: number;
};

export function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <ThemedView type="backgroundSelected" style={styles.track}>
      <View style={[styles.fill, { width: `${clamped}%` }]} />
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
    backgroundColor: ACCENT,
  },
});
