import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// Coloured status dot, used in place of the 🔴🟠🟡🟢⚪ emoji.
export type DotColor = 'red' | 'orange' | 'yellow' | 'green' | 'grey';

const DOT_COLORS: Record<DotColor, string> = {
  red: '#dc2626', orange: '#ea580c', yellow: '#ca8a04', green: '#16a34a', grey: '#9ca3af',
};

export default function StatusDot({ color, size = 14 }: { color: DotColor; size?: number }) {
  return <Ionicons name="ellipse" size={size} color={DOT_COLORS[color]} />;
}
