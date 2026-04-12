/**
 * Client-side database using IndexedDB via idb library.
 * All data is stored in the user's browser — no server needed.
 * Data persists across sessions and app restarts on the same device.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { FoodEntry, InsertFoodEntry, GlucoseReading, InsertGlucoseReading, UserSettings, InsertUserSettings } from "@shared/schema";

const DB_NAME = "housemd-food-tracker";
const DB_VERSION = 2; // bumped for recipes store

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("food_entries")) {
          const foodStore = db.createObjectStore("food_entries", { keyPath: "id", autoIncrement: true });
          foodStore.createIndex("date", "date");
        }
        if (!db.objectStoreNames.contains("glucose_readings")) {
          const glucoseStore = db.createObjectStore("glucose_readings", { keyPath: "id", autoIncrement: true });
          glucoseStore.createIndex("date", "date");
        }
        if (!db.objectStoreNames.contains("user_settings")) {
          db.createObjectStore("user_settings", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("recipes")) {
          db.createObjectStore("recipes", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Recipe types ──────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  fat: number;
  totalCarbs: number;
  fiber: number;
  netCarbs: number;
}

export interface Recipe {
  id: number;
  name: string;
  servings: number;          // how many servings the recipe makes
  ingredients: RecipeIngredient[];
  // totals for the whole recipe (sum of all ingredients)
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber: number;
  totalNetCarbs: number;
  createdAt: string;
  updatedAt: string;
}

export type InsertRecipe = Omit<Recipe, "id">;

// ─── Recipe CRUD ───────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  const db = await getDB();
  const all = await db.getAll("recipes");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRecipe(id: number): Promise<Recipe | undefined> {
  const db = await getDB();
  return db.get("recipes", id);
}

export async function saveRecipe(recipe: InsertRecipe): Promise<Recipe> {
  const db = await getDB();
  const id = await db.add("recipes", recipe);
  return { ...recipe, id: id as number };
}

export async function updateRecipe(id: number, updates: Partial<InsertRecipe>): Promise<Recipe | undefined> {
  const db = await getDB();
  const existing = await db.get("recipes", id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await db.put("recipes", updated);
  return updated;
}

export async function deleteRecipe(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("recipes", id);
}

const DEFAULT_SETTINGS: Omit<UserSettings, "id"> = {
  calorieTarget: 2000,
  proteinTarget: 150,
  fatTarget: 100,
  totalCarbTarget: 50,
  netCarbTarget: 30,
  dietMode: "low-carb",
  glucoseTargetFasting: 90,
  glucoseTargetPostMeal: 120,
};

export async function getFoodEntries(date: string): Promise<FoodEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("food_entries", "date", date);
}

export async function getFoodEntriesByDateRange(startDate: string, endDate: string): Promise<FoodEntry[]> {
  const db = await getDB();
  const all = await db.getAll("food_entries");
  return all.filter(e => e.date >= startDate && e.date <= endDate);
}

export async function addFoodEntry(entry: InsertFoodEntry): Promise<FoodEntry> {
  const db = await getDB();
  const id = await db.add("food_entries", entry);
  return { ...entry, id: id as number };
}

export async function updateFoodEntry(id: number, updates: Partial<InsertFoodEntry>): Promise<FoodEntry | undefined> {
  const db = await getDB();
  const existing = await db.get("food_entries", id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  await db.put("food_entries", updated);
  return updated;
}

export async function deleteFoodEntry(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("food_entries", id);
}

export async function getGlucoseReadings(date: string): Promise<GlucoseReading[]> {
  const db = await getDB();
  return db.getAllFromIndex("glucose_readings", "date", date);
}

export async function getGlucoseReadingsByDateRange(startDate: string, endDate: string): Promise<GlucoseReading[]> {
  const db = await getDB();
  const all = await db.getAll("glucose_readings");
  return all.filter(r => r.date >= startDate && r.date <= endDate)
            .sort((a, b) => a.date.localeCompare(b.date));
}

export async function addGlucoseReading(reading: InsertGlucoseReading): Promise<GlucoseReading> {
  const db = await getDB();
  const id = await db.add("glucose_readings", reading);
  return { ...reading, id: id as number };
}

export async function deleteGlucoseReading(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("glucose_readings", id);
}

export async function getSettings(): Promise<UserSettings> {
  const db = await getDB();
  const all = await db.getAll("user_settings");
  if (all.length > 0) return all[0];
  const id = await db.add("user_settings", DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, id: id as number };
}

export async function updateSettings(updates: Partial<InsertUserSettings>): Promise<UserSettings> {
  const db = await getDB();
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await db.put("user_settings", updated);
  return updated;
}

export async function seedSampleData(): Promise<void> {
  const db = await getDB();
  await db.clear("food_entries");
  await db.clear("glucose_readings");

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const meals = [
    { mealType: "breakfast", name: "Scrambled Eggs (3 large)", servingSize: "3 eggs", calories: 210, protein: 18, fat: 15, totalCarbs: 1, fiber: 0, netCarbs: 1 },
    { mealType: "breakfast", name: "Avocado", servingSize: "1/2 avocado", calories: 120, protein: 1.5, fat: 11, totalCarbs: 6, fiber: 4.6, netCarbs: 1.4 },
    { mealType: "lunch", name: "Grilled Salmon", servingSize: "6 oz", calories: 350, protein: 40, fat: 20, totalCarbs: 0, fiber: 0, netCarbs: 0 },
    { mealType: "lunch", name: "Mixed Green Salad", servingSize: "2 cups", calories: 45, protein: 3, fat: 2, totalCarbs: 8, fiber: 3, netCarbs: 5 },
    { mealType: "dinner", name: "Ribeye Steak", servingSize: "8 oz", calories: 580, protein: 48, fat: 42, totalCarbs: 0, fiber: 0, netCarbs: 0 },
    { mealType: "dinner", name: "Roasted Broccoli", servingSize: "1 cup", calories: 55, protein: 4, fat: 3, totalCarbs: 11, fiber: 5, netCarbs: 6 },
    { mealType: "snack", name: "Macadamia Nuts", servingSize: "1 oz", calories: 200, protein: 2, fat: 21, totalCarbs: 4, fiber: 2.4, netCarbs: 1.6 },
    { mealType: "snack", name: "String Cheese", servingSize: "1 stick", calories: 80, protein: 7, fat: 5, totalCarbs: 1, fiber: 0, netCarbs: 1 },
  ];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = fmt(d);
    const createdAt = d.toISOString();
    const dayMeals = [...meals].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3));
    for (const meal of dayMeals) {
      await db.add("food_entries", { ...meal, date: dateStr, tags: null, source: "manual", createdAt });
    }
    const fastingVal = 82 + Math.round(Math.random() * 18);
    const postMealVal = 105 + Math.round(Math.random() * 35);
    await db.add("glucose_readings", { date: dateStr, time: "07:00", type: "fasting", value: fastingVal, notes: null, createdAt });
    if (Math.random() > 0.3) {
      await db.add("glucose_readings", { date: dateStr, time: "14:00", type: "post-meal", value: postMealVal, notes: null, createdAt });
    }
  }
}
