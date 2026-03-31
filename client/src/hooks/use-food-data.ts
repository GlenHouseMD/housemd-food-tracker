import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FoodEntry, InsertFoodEntry, GlucoseReading, InsertGlucoseReading, UserSettings } from "@shared/schema";
import { format } from "date-fns";

export function useFoodEntries(date: string) {
  return useQuery<FoodEntry[]>({
    queryKey: ["/api/food-entries", date],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/food-entries?date=${date}`);
      return res.json();
    },
  });
}

export function useFoodEntriesRange(startDate: string, endDate: string) {
  return useQuery<FoodEntry[]>({
    queryKey: ["/api/food-entries/range", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/food-entries/range?startDate=${startDate}&endDate=${endDate}`);
      return res.json();
    },
  });
}

export function useAddFoodEntry() {
  return useMutation({
    mutationFn: async (entry: InsertFoodEntry) => {
      const res = await apiRequest("POST", "/api/food-entries", entry);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries/range"] });
    },
  });
}

export function useDeleteFoodEntry() {
  return useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      await apiRequest("DELETE", `/api/food-entries/${id}`);
      return { date };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries/range"] });
    },
  });
}

export function useGlucoseReadings(date: string) {
  return useQuery<GlucoseReading[]>({
    queryKey: ["/api/glucose", date],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/glucose?date=${date}`);
      return res.json();
    },
  });
}

export function useGlucoseRange(startDate: string, endDate: string) {
  return useQuery<GlucoseReading[]>({
    queryKey: ["/api/glucose/range", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/glucose/range?startDate=${startDate}&endDate=${endDate}`);
      return res.json();
    },
  });
}

export function useAddGlucoseReading() {
  return useMutation({
    mutationFn: async (reading: InsertGlucoseReading) => {
      const res = await apiRequest("POST", "/api/glucose", reading);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/glucose"] });
    },
  });
}

export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings");
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      const res = await apiRequest("PATCH", "/api/settings", settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}

export function useSeedData() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// Utility: aggregate daily totals from entries
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
