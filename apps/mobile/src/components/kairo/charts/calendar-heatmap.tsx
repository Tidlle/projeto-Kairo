import type { DailyBalance } from '@kairo/core';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Mesmo par azul/laranja do bar-chart — "pra onde o dinheiro foi" usa a
 * mesma linguagem visual em todo o dashboard, e evita o par vermelho/verde
 * (o mais comum de confundir em daltonismo) pela segunda vez.
 */
const POSITIVE_COLOR = '#4DA3E0';
const NEGATIVE_COLOR = '#E0735C';

const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CELL = 28;
const GAP = 4;

function intensity(netCents: number, maxAbs: number): number {
  if (maxAbs === 0) return 0.35;
  return Math.max(0.25, Math.min(1, Math.abs(netCents) / maxAbs));
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

type CalendarHeatmapProps = {
  /** Dias consecutivos de UM mês, começando no dia 1. */
  data: DailyBalance[];
};

export function CalendarHeatmap({ data }: CalendarHeatmapProps) {
  const theme = useTheme();
  if (data.length === 0) return null;

  const firstDay = data[0];
  if (!firstDay) return null;
  const firstWeekday = new Date(`${firstDay.date}T12:00:00`).getDay();
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.netCents)));

  const leadingBlanks = Array.from({ length: firstWeekday }, (_, i) => `blank-${i}`);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <ThemedText key={`wd-${i}`} type="small" themeColor="textSecondary" style={styles.cell}>
            {letter}
          </ThemedText>
        ))}
      </View>
      <View style={styles.grid}>
        {leadingBlanks.map((key) => (
          <View key={key} style={styles.cell} />
        ))}
        {data.map((day) => {
          const dayOfMonth = Number(day.date.slice(8, 10));
          const color =
            day.netCents === 0
              ? theme.backgroundSelected
              : withAlpha(day.netCents > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR, intensity(day.netCents, maxAbs));
          return (
            <View key={day.date} style={[styles.cell, styles.dayCell, { backgroundColor: color }]}>
              <ThemedText type="small" style={styles.dayNumber}>
                {dayOfMonth}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.swatch, { backgroundColor: withAlpha(NEGATIVE_COLOR, 0.8) }]} />
        <ThemedText type="small" themeColor="textSecondary">
          negativo
        </ThemedText>
        <View style={[styles.swatch, { backgroundColor: theme.backgroundSelected, marginLeft: Spacing.three }]} />
        <ThemedText type="small" themeColor="textSecondary">
          sem movimento
        </ThemedText>
        <View style={[styles.swatch, { backgroundColor: withAlpha(POSITIVE_COLOR, 0.8), marginLeft: Spacing.three }]} />
        <ThemedText type="small" themeColor="textSecondary">
          positivo
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    textAlign: 'center',
  },
  dayCell: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 11,
    lineHeight: 13,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
