import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type SectionCardProps = {
  title: string;
  children: ReactNode;
  /** Link opcional no canto do cabeçalho — ex.: "ver todas" para a lista completa. */
  actionLabel?: string;
  onPressAction?: () => void;
};

/** Bloco padrão de seção da tela Hoje — título pequeno em maiúsculas + conteúdo. */
export function SectionCard({ title, children, actionLabel, onPressAction }: SectionCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
          {title}
        </ThemedText>
        {actionLabel && onPressAction && (
          <Pressable onPress={onPressAction} hitSlop={8}>
            <ThemedText type="link" themeColor="textSecondary">
              {actionLabel}
            </ThemedText>
          </Pressable>
        )}
      </View>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    textTransform: 'uppercase',
  },
});
