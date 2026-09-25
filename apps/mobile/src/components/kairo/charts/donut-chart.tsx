import { formatBRL, type CategoryTotal } from '@kairo/core';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Ordem fixa, nunca gerada — a mesma categoria sempre cai na mesma cor entre
 * uma visita e outra do dashboard. Âmbar primeiro (é a cor da marca, e
 * categorização costuma ter uma categoria dominante). Acima de 6 categorias,
 * o resto vira "Outros" em cinza — uma 9ª fatia gerada na hora não teria
 * como continuar distinguível das outras.
 */
const CATEGORY_COLORS = ['#E6A94E', '#4CAF7D', '#B48FD1', '#5FBFBF', '#4DA3E0', '#E0735C'];
const OTHER_COLOR = '#98A2B0';
const MAX_SLICES = 6;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');
}

type Slice = { name: string; color: string; totalCents: number };

/** Top N categorias + o resto agrupado em "Outros", nunca mais que MAX_SLICES fatias. */
function toSlices(data: CategoryTotal[]): Slice[] {
  const sorted = [...data].sort((a, b) => b.totalCents - a.totalCents);
  const top = sorted.slice(0, MAX_SLICES - 1).map((c, i) => ({
    name: c.name,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] ?? OTHER_COLOR,
    totalCents: c.totalCents,
  }));
  const rest = sorted.slice(MAX_SLICES - 1);
  const restTotal = rest.reduce((sum, c) => sum + c.totalCents, 0);
  return restTotal > 0 ? [...top, { name: 'Outros', color: OTHER_COLOR, totalCents: restTotal }] : top;
}

type DonutChartProps = {
  data: CategoryTotal[];
  size?: number;
};

export function DonutChart({ data, size = 140 }: DonutChartProps) {
  const slices = toSlices(data);
  const total = slices.reduce((sum, s) => sum + s.totalCents, 0);

  if (total === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Sem gastos categorizados no período.
      </ThemedText>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = size / 3;
  const gapDeg = slices.length > 1 ? 2 : 0;

  // reduce, não um `let` externo mutado dentro do map — o React Compiler deste
  // projeto rejeita reatribuir uma variável de fora durante o render.
  const { paths } = slices.reduce<{ angle: number; paths: { key: string; d: string; color: string }[] }>(
    (acc, slice) => {
      const sweep = (slice.totalCents / total) * 360;
      const start = acc.angle + gapDeg / 2;
      const end = acc.angle + sweep - gapDeg / 2;
      return {
        angle: acc.angle + sweep,
        paths: [
          ...acc.paths,
          { key: slice.name, d: donutSlicePath(cx, cy, rOuter, rInner, Math.max(start, 0), Math.max(end, start)), color: slice.color },
        ],
      };
    },
    { angle: 0, paths: [] },
  );

  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p) => (
          <Path key={p.key} d={p.d} fill={p.color} />
        ))}
      </Svg>
      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.name} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: slice.color }]} />
            <ThemedText type="small" style={styles.legendName} numberOfLines={1}>
              {slice.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatBRL(slice.totalCents)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  legend: {
    flex: 1,
    gap: Spacing.one,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
  },
});
