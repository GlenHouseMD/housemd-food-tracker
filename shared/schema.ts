import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Food entries logged by the user
export const foodEntries = sqliteTable("food_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  mealType: text("meal_type").notNull(), // breakfast, lunch, dinner, snack
  name: text("name").notNull(),
  servingSize: text("serving_size").notNull(),
  calories: real("calories").notNull(),
  protein: real("protein").notNull(), // grams
  fat: real("fat").notNull(), // grams
  totalCarbs: real("total_carbs").notNull(), // grams
  fiber: real("fiber").notNull().default(0), // grams
  netCarbs: real("net_carbs").notNull(), // grams (totalCarbs - fiber)
  tags: text("tags"), // JSON array: ["high-protein", "low-carb", "ketogenic", "mixed"]
  source: text("source").default("manual"), // manual, search, barcode, photo
  createdAt: text("created_at").notNull(),
});

// Glucose / metabolic readings
export const glucoseReadings = sqliteTable("glucose_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:MM
  type: text("type").notNull(), // fasting, pre-meal, post-meal, cgm
  value: real("value").notNull(), // mg/dL
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// User settings / macro targets
export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  calorieTarget: real("calorie_target").notNull().default(2000),
  proteinTarget: real("protein_target").notNull().default(150),
  fatTarget: real("fat_target").notNull().default(100),
  totalCarbTarget: real("total_carb_target").notNull().default(50),
  netCarbTarget: real("net_carb_target").notNull().default(30),
  dietMode: text("diet_mode").notNull().default("low-carb"), // standard, low-carb, ketogenic, custom
  glucoseTargetFasting: real("glucose_target_fasting").default(90),
  glucoseTargetPostMeal: real("glucose_target_post_meal").default(120),
});

// Insert schemas
export const insertFoodEntrySchema = createInsertSchema(foodEntries).omit({ id: true });
export const insertGlucoseReadingSchema = createInsertSchema(glucoseReadings).omit({ id: true });
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({ id: true });

// Types
export type FoodEntry = typeof foodEntries.$inferSelect;
export type InsertFoodEntry = z.infer<typeof insertFoodEntrySchema>;
export type GlucoseReading = typeof glucoseReadings.$inferSelect;
export type InsertGlucoseReading = z.infer<typeof insertGlucoseReadingSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

// Daily summary type (computed, not stored)
export interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalNetCarbs: number;
  entries: FoodEntry[];
}
