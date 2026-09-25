import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontFamily, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'money';
  themeColor?: ThemeColor;
};

/** `linkPrimary` gruda no acento da marca por padrão — pode ser sobrescrito passando `themeColor`. */
const DEFAULT_COLOR: Partial<Record<NonNullable<ThemedTextProps['type']>, ThemeColor>> = {
  linkPrimary: 'accent',
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? DEFAULT_COLOR[type] ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'money' && styles.money,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 48,
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    lineHeight: 44,
  },
  link: {
    fontFamily: FontFamily.body,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: FontFamily.bodyBold,
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  /**
   * Valores em dinheiro — de propósito NÃO usa a Fraunces (`display`). Uma
   * serifa decorativa em cima de um número dificulta a leitura rápida
   * exatamente onde ela mais importa; Inter em negrito, com dígitos
   * tabulares (mesma largura para todo algarismo), lê mais limpo e ainda
   * alinha em coluna quando dois valores aparecem um embaixo do outro.
   */
  money: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
});
