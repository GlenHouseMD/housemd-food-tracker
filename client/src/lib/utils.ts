import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, subDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'yyyy-MM-dd');
}

export function formatDisplayDate(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date + 'T12:00:00') : date, 'MMM d, yyyy');
}

export function getDateRange(days: number): { startDate: string; endDate: string } {
  const today = new Date();
  return {
    startDate: format(subDays(today, days - 1), 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  };
}

export function calculateNetCarbs(totalCarbs: number, fiber: number): number {
  return Math.max(0, totalCarbs - fiber);
}

export function getMealTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snacks',
  };
  return labels[type] || type;
}

export function getMealTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🥜',
  };
  return icons[type] || '🍽️';
}

export function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    'ketogenic': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'low-carb': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    'high-protein': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'mixed': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return colors[tag] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
}
