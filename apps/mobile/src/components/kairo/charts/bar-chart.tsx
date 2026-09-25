import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { MonthlyTotal } from '@kairo/core';

/**
 * Entradas x saídas por mês, um par de barras por mês. Azul e laranja de
 * propósito, não verde/vermelho — o par mais comum de daltonismo (proto/
 * deuteranopia) confunde vermelho com verde; azul x laranja continua
 * distinguível.
 */
const INCOME_COLOR = '#4DA3E0';
const EXPENSE_COLOR = '#E0735C';

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

type BarChartProps = {
  data: MonthlyTotal[];
  height?: number;
};

export function BarChart({ data, height = 140 }: BarChartProps) {
  const maxValue = Math.max(1, ...data.map((m) => Math.max(m.incomeCents, Math.abs(m.expenseCents))));

  const barWidth = 10;
  const groupGap = 22;
  const barGap = 3;
  const groupWidth = barWidth * 2 + barGap;
  const width = Math.max(200, data.length * (groupWidth + groupGap));
  const chartHeight = height - 20; // reserva espaço pro rótulo do mês

  return (
    <View>
      <View style={styles.legendRow}>
        <LegendDot color={INCOME_COLOR} label="Entradas" />
        <LegendDot color={EXPENSE_COLOR} label="Saídas" />
      </View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {data.flatMap((month, i) => {
          const groupX = i * (groupWidth + groupGap) + groupGap / 2;
          const incomeHeight = Math.max(2, (month.incomeCents / maxValue) * chartHeight);
          const expenseHeight = Math.max(2, (Math.abs(month.expenseCents) / maxValue) * chartHeight);

          return [
            <Rect
              key={`${month.month}-income`}
              x={groupX}
              y={chartHeight - incomeHeight}
              width={barWidth}
              height={incomeHeight}
              rx={4}
              fill={INCOME_COLOR}
            />,
            <Rect
              key={`${month.month}-expense`}
              x={groupX + barWidth + barGap}
              y={chartHeight - expenseHeight}
              width={barWidth}
              height={expenseHeight}
              rx={4}
              fill={EXPENSE_COLOR}
            />,
          ];
        })}
      </Svg>
      <View style={[styles.labelRow, { width }]}>
        {data.map((month) => (
          <ThemedText key={month.month} type="small" themeColor="textSecondary" style={[styles.monthLabel, { width: groupWidth + groupGap }]}>
            {MONTH_LABEL.format(new Date(`${month.month}-01T12:00:00`)).replace('.', '')}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelRow: {
    flexDirection: 'row',
  },
  monthLabel: {
    textAlign: 'center',
    textTransform: 'capitalize',
  },
});
