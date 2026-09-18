import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

type DateTimeFieldProps = {
  value: Date;
  onChange: (date: Date) => void;
  /** Esconde o botão de hora — usado para "dia inteiro"/prazo só de data. */
  showTime?: boolean;
};

/**
 * Par de botões (data, hora) que abrem o `DateTimePicker` nativo no modo
 * certo — Android só suporta os modos `date`/`time` separados (não
 * `datetime`), por isso o mesmo componente serve os dois sistemas via dois
 * passos em vez de um único seletor combinado.
 *
 * iOS usa `display="spinner"`, que fica inline e não fecha sozinho — por
 * isso o botão "pronto" só aparece lá. Android usa o diálogo nativo, que
 * já fecha e dispara `onChange` sozinho.
 *
 * Reaproveitado por `agenda-screen.tsx` (início/fim de evento) e
 * `tasks-screen.tsx` (prazo da tarefa) — mesmo componente, mesmo
 * comportamento nos dois lugares.
 */
export function DateTimeField({ value, onChange, showTime = true }: DateTimeFieldProps) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setMode(null);
    if (selected) onChange(selected);
  }

  return (
    <View>
      <View style={styles.row}>
        <Pressable onPress={() => setMode('date')} style={styles.button}>
          <ThemedText type="small">{dayFmt.format(value)}</ThemedText>
        </Pressable>
        {showTime && (
          <Pressable onPress={() => setMode('time')} style={styles.button}>
            <ThemedText type="small">{timeFmt.format(value)}</ThemedText>
          </Pressable>
        )}
      </View>
      {mode && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' && (
            <Pressable onPress={() => setMode(null)} style={styles.doneButton}>
              <ThemedText type="link">pronto</ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  button: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#868e96',
  },
  pickerWrap: { alignItems: 'center' },
  doneButton: { paddingVertical: Spacing.one },
});
