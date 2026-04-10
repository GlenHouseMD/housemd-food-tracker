import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { FoodEntry, InsertFoodEntry, GlucoseReading, InsertGlucoseReading, UserSettings } from "@shared/schema";
import * as db from "@/lib/db";

export function useFoodEntries(date: string) {
  return useQuery<FoodEntry[]>({
    queryKey: ["/api/food-entries", date],
    queryFn: () => db.getFoodEntries(date),
  });
}

export function useFoodEntriesRange(startDate: string, endDate: string) {
  return useQuery<FoodEntry[]>({
    queryKey: ["/api/food-entries/range", startDate, endDate],
    queryFn: () => db.getFoodEntriesByDateRange(startDate, endDate),
  });
}

export function useAddFoodEntry() {
  return useMutation({
    mutationFn: (entry: InsertFoodEntry) => db.addFoodEntry(entry),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries/range"] });
    },
  });
}

export function useDeleteFoodEntry() {
  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      db.deleteFoodEntry(id).then(() => ({ date })),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries/range"] });
    },
  });
}

export function useGlucoseReadings(date: string) {
  return useQuery<GlucoseReading[]>({
    queryKey: ["/api/glucose", date],
    queryFn: () => db.getGlucoseReadings(date),
  });
}

export function useGlucoseRange(startDate: string, endDate: string) {
  return useQuery<GlucoseReading[]>({
    queryKey: ["/api/glucose/range", startDate, endDate],
    queryFn: () => db.getGlucoseReadingsByDateRange(startDate, endDate),
  });
}

export function useAddGlucoseReading() {
  return useMutation({
    mutationFn: (reading: InsertGlucoseReading) => db.addGlucoseReading(reading),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/glucose"] });
    },
  });
}

export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    queryFn: () => db.getSettings(),
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) => db.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}

export function useSeedData() {
  return useMutation({
    mutationFn: () => db.seedSampleData(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function aggregateDailyTotals(entries: FoodEntry[]) {
  const byDate: Record<string, { calories: number; protein: number; fat: number; totalCarbs: number; netCarbs: number; count: number }> = {};
  for (const entry of entries) {
    if (!byDate[entry.date]) {
      byDate[entry.date] = { calories: 0, protein: 0, fat: 0, totalCarbs: 0, netCarbs: 0, count: 0 };
    }
    byDate[entry.date].calories += entry.calories;
    byDate[entry.date].protein += entry.protein;
    byDate[entry.date].fat += entry.fat;
    byDate[entry.date].totalCarbs += entry.totalCarbs;
    byDate[entry.date].netCarbs += entry.netCarbs;
    byDate[entry.date].count += 1;
  }
  return byDate;
}
