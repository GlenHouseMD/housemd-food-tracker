import { 
  foodEntries, glucoseReadings, userSettings,
  type FoodEntry, type InsertFoodEntry,
  type GlucoseReading, type InsertGlucoseReading,
  type UserSettings, type InsertUserSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface IStorage {
  // Food entries
  getFoodEntries(date: string): FoodEntry[];
  getFoodEntriesByDateRange(startDate: string, endDate: string): FoodEntry[];
  addFoodEntry(entry: InsertFoodEntry): FoodEntry;
  updateFoodEntry(id: number, entry: Partial<InsertFoodEntry>): FoodEntry | undefined;
  deleteFoodEntry(id: number): void;

  // Glucose readings
  getGlucoseReadings(date: string): GlucoseReading[];
  getGlucoseReadingsByDateRange(startDate: string, endDate: string): GlucoseReading[];
  addGlucoseReading(reading: InsertGlucoseReading): GlucoseReading;
  deleteGlucoseReading(id: number): void;

  // User settings
  getSettings(): UserSettings;
  updateSettings(settings: Partial<InsertUserSettings>): UserSettings;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Seed default settings if none exist
    const existing = db.select().from(userSettings).get();
    if (!existing) {
      db.insert(userSettings).values({
        calorieTarget: 2000,
        proteinTarget: 150,
        fatTarget: 100,
        totalCarbTarget: 50,
        netCarbTarget: 30,
        dietMode: "low-carb",
        glucoseTargetFasting: 90,
        glucoseTargetPostMeal: 120,
      }).run();
    }
  }

  getFoodEntries(date: string): FoodEntry[] {
    return db.select().from(foodEntries).where(eq(foodEntries.date, date)).all();
  }

  getFoodEntriesByDateRange(startDate: string, endDate: string): FoodEntry[] {
    return db.select().from(foodEntries)
      .where(and(gte(foodEntries.date, startDate), lte(foodEntries.date, endDate)))
      .all();
  }

  addFoodEntry(entry: InsertFoodEntry): FoodEntry {
    return db.insert(foodEntries).values(entry).returning().get();
  }

  updateFoodEntry(id: number, entry: Partial<InsertFoodEntry>): FoodEntry | undefined {
    return db.update(foodEntries).set(entry).where(eq(foodEntries.id, id)).returning().get();
  }

  deleteFoodEntry(id: number): void {
    db.delete(foodEntries).where(eq(foodEntries.id, id)).run();
  }

  getGlucoseReadings(date: string): GlucoseReading[] {
    return db.select().from(glucoseReadings).where(eq(glucoseReadings.date, date)).all();
  }

  getGlucoseReadingsByDateRange(startDate: string, endDate: string): GlucoseReading[] {
    return db.select().from(glucoseReadings)
      .where(and(gte(glucoseReadings.date, startDate), lte(glucoseReadings.date, endDate)))
      .orderBy(desc(glucoseReadings.date))
      .all();
  }

  addGlucoseReading(reading: InsertGlucoseReading): GlucoseReading {
    return db.insert(glucoseReadings).values(reading).returning().get();
  }

  deleteGlucoseReading(id: number): void {
    db.delete(glucoseReadings).where(eq(glucoseReadings.id, id)).run();
  }

  getSettings(): UserSettings {
    return db.select().from(userSettings).get()!;
  }

  updateSettings(settings: Partial<InsertUserSettings>): UserSettings {
    const current = this.getSettings();
    return db.update(userSettings).set(settings).where(eq(userSettings.id, current.id)).returning().get();
  }
}

export const storage = new DatabaseStorage();
