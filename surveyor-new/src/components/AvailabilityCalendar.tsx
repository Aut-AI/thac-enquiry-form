import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const GREEN = '#1a3c2e';
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface DragPreview {
  dates: Set<string>;
  value: boolean;
}

interface MonthGridProps {
  monthDate: Date;
  availability: Record<string, boolean>;
  onCommitDays: (dates: string[], isAvailable: boolean) => void;
  disabled: boolean;
}

// Monday-first day-of-week index (JS getDay() is Sunday-first).
function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function MonthGrid({ monthDate, availability, onCommitDays, disabled }: MonthGridProps) {
  const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstDayOffset = mondayFirstIndex(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const rows = Math.ceil((daysInMonth + firstDayOffset) / 7);

  const cellSize = useRef(0);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  // Builds the "YYYY-MM-DD" string directly from the known local
  // year/month/day rather than going via Date.toISOString(), which
  // converts to UTC and rolls the date back a day for any positive UTC
  // offset (BST included) -- every date in the grid was landing one day
  // early for exactly that reason.
  const dateForIndex = useCallback((dayIndex: number): string | null => {
    const day = dayIndex - firstDayOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    const mm = String(monthDate.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${monthDate.getFullYear()}-${mm}-${dd}`;
  }, [monthDate, firstDayOffset, daysInMonth]);

  // e.x/e.y from the gesture are already relative to the grid View the
  // GestureDetector is attached to (not the screen or a parent), so no
  // offset needs to be subtracted here -- only the layout's width is
  // needed, to derive each cell's size.
  const cellAtPoint = useCallback((x: number, y: number): string | null => {
    if (cellSize.current <= 0) return null;
    const col = Math.floor(x / cellSize.current);
    const row = Math.floor(y / cellSize.current);
    if (col < 0 || col > 6 || row < 0 || row >= rows) return null;
    return dateForIndex(row * 7 + col);
  }, [dateForIndex, rows]);

  // Mirrors dragPreview so onFinalize can read the final selection without
  // reaching into it from inside a setState updater -- calling the parent's
  // onCommitDays (a different component's state setter) from inside
  // setDragPreview's updater is exactly what React's "Cannot update a
  // component while rendering a different component" guards against.
  const dragPreviewRef = useRef<DragPreview | null>(null);

  const extendDrag = useCallback((x: number, y: number) => {
    const date = cellAtPoint(x, y);
    if (!date) return;
    setDragPreview(prev => {
      let next: DragPreview;
      if (!prev) {
        const startValue = availability[date] === false ? true : false;
        next = { dates: new Set([date]), value: startValue };
      } else if (prev.dates.has(date)) {
        next = prev;
      } else {
        const dates = new Set(prev.dates);
        dates.add(date);
        next = { dates, value: prev.value };
      }
      dragPreviewRef.current = next;
      return next;
    });
  }, [cellAtPoint, availability]);

  const gesture = Gesture.Pan()
    .minDistance(0)
    .enabled(!disabled)
    .onBegin((e) => {
      extendDrag(e.x, e.y);
    })
    .onUpdate((e) => {
      extendDrag(e.x, e.y);
    })
    .onFinalize(() => {
      const finished = dragPreviewRef.current;
      dragPreviewRef.current = null;
      setDragPreview(null);
      if (finished && finished.dates.size > 0) {
        onCommitDays(Array.from(finished.dates), finished.value);
      }
    });

  const onGridLayout = (e: LayoutChangeEvent) => {
    cellSize.current = e.nativeEvent.layout.width / 7;
  };

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const date = dateForIndex(i);
    if (!date) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
      continue;
    }
    const isPreviewed = dragPreview?.dates.has(date);
    const isAvail = isPreviewed ? dragPreview!.value : availability[date] !== false;
    const day = Number(date.split('-')[2]);
    cells.push(
      <View key={date} style={styles.dayCell}>
        <View style={[
          styles.dayInner,
          isAvail ? styles.dayAvailable : styles.dayUnavailable,
          isPreviewed && styles.dayPreviewed,
        ]}>
          <Text style={[styles.dayText, !isAvail && styles.dayTextUnavailable]}>{day}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.monthCard}>
      <Text style={styles.monthName}>{monthName}</Text>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>
      <GestureDetector gesture={gesture}>
        <View style={styles.monthGrid} onLayout={onGridLayout}>
          {cells}
        </View>
      </GestureDetector>
    </View>
  );
}

interface AvailabilityCalendarProps {
  availability: Record<string, boolean>;
  onCommitDays: (dates: string[], isAvailable: boolean) => void;
  monthsToShow?: number;
  disabled?: boolean;
}

export function AvailabilityCalendar({ availability, onCommitDays, monthsToShow = 12, disabled = false }: AvailabilityCalendarProps) {
  const today = new Date();
  const months: React.ReactNode[] = [];

  for (let m = 0; m < monthsToShow; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1);
    months.push(
      <MonthGrid
        key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
        monthDate={monthDate}
        availability={availability}
        onCommitDays={onCommitDays}
        disabled={disabled}
      />
    );
  }

  return <View>{months}</View>;
}

const styles = StyleSheet.create({
  monthCard: {
    backgroundColor: '#fafbfa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 12,
  },
  monthName: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
    marginBottom: 10,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  dayInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayAvailable: {
    backgroundColor: '#bbf7d0',
  },
  dayUnavailable: {
    backgroundColor: '#f3f4f6',
  },
  dayPreviewed: {
    borderWidth: 2,
    borderColor: GREEN,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  dayTextUnavailable: {
    color: '#9ca3af',
  },
});
