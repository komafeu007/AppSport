import { StyleSheet, Text, View } from 'react-native';

import { dayKey, startOfWeek } from '../lib/format';
import { useThemedStyles, type Theme } from '../theme';
import { scale, MAX_FONT_SCALE, spacing, text } from '../theme/tokens';
import PressableScale from './ui/PressableScale';

export type CalendarMode = 'week' | 'month';

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  mode: CalendarMode;
  /** Nombre de séances terminées par jour (clé `dayKey`). */
  countsByDay: ReadonlyMap<string, number>;
  /** Toucher le calendrier bascule semaine ↔ mois. */
  onToggle: () => void;
  today?: Date;
}

type Cell = { date: Date; inPeriod: boolean } | null;

/** Jours affichés : la semaine (lundi → dimanche) ou le mois, calé sur des semaines pleines. */
function buildCells(mode: CalendarMode, today: Date): Cell[][] {
  if (mode === 'week') {
    const start = startOfWeek(today);
    return [
      Array.from({ length: 7 }, (_, index) => ({
        date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
        inPeriod: true,
      })),
    ];
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: Cell[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => ({
      date: new Date(today.getFullYear(), today.getMonth(), index + 1),
      inPeriod: true,
    })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Cell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/**
 * Grille des séances faites : une case par jour, pleine (kaki, « validé »)
 * quand une séance y a été terminée. Vue semaine par défaut ; un toucher
 * déplie le mois, un autre la replie.
 */
export default function SessionCalendar({ mode, countsByDay, onToggle, today = new Date() }: Props) {
  const styles = useThemedStyles(createStyles);
  const todayKey = dayKey(today);
  const weeks = buildCells(mode, today);

  return (
    <PressableScale
      onPress={onToggle}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={mode === 'week' ? 'Afficher le mois' : 'Afficher la semaine'}
      style={styles.wrap}
    >
      <View style={styles.week}>
        {WEEKDAY_LETTERS.map((letter, index) => (
          <Text key={index} maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.weekday}>
            {letter}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((cell, index) => {
            if (cell === null) return <View key={index} style={[styles.cell, styles.cellBlank]} />;
            const key = dayKey(cell.date);
            const count = countsByDay.get(key) ?? 0;
            const done = count > 0;
            const isToday = key === todayKey;
            return (
              <View
                key={index}
                style={[styles.cell, done && styles.cellDone, isToday && !done && styles.cellToday]}
                accessible
                accessibilityLabel={`${cell.date.getDate()}${done ? `, ${count} séance${count > 1 ? 's' : ''}` : ''}`}
              >
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={[styles.day, done && styles.dayDone, isToday && !done && styles.dayToday]}
                >
                  {String(cell.date.getDate()).padStart(2, '0')}
                </Text>
                {count > 1 ? (
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.count, styles.dayDone]}>
                    ×{count}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </PressableScale>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    week: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    weekday: {
      ...text.caption,
      flex: 1,
      textAlign: 'center',
      color: theme.colors.textMuted,
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cellBlank: {
      borderColor: 'transparent',
    },
    cellDone: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    cellToday: {
      borderColor: theme.colors.text,
    },
    day: {
      ...text.caption,
      color: theme.colors.textMuted,
    },
    dayDone: {
      color: theme.colors.onSuccess,
    },
    dayToday: {
      fontFamily: text.label.fontFamily,
      color: theme.colors.text,
    },
    count: {
      ...text.caption,
      fontSize: scale(10),
      lineHeight: scale(12),
    },
  });
