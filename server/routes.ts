import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertFoodEntrySchema, insertGlucoseReadingSchema } from "@shared/schema";
import { seedSampleData } from "./seed";

export async function registerRoutes(server: Server, app: Express) {
  // --- Health Check ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- Food Entries ---
  app.get("/api/food-entries", (req, res) => {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: "date query parameter required" });
    }
    const entries = storage.getFoodEntries(date);
    res.json(entries);
  });

  app.get("/api/food-entries/range", (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate query parameters required" });
    }
    const entries = storage.getFoodEntriesByDateRange(startDate, endDate);
    res.json(entries);
  });

  app.post("/api/food-entries", (req, res) => {
    const parsed = insertFoodEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const entry = storage.addFoodEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/food-entries/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const entry = storage.updateFoodEntry(id, req.body);
    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }
    res.json(entry);
  });

  app.delete("/api/food-entries/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deleteFoodEntry(id);
    res.status(204).send();
  });

  // --- Glucose Readings ---
  app.get("/api/glucose", (req, res) => {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: "date query parameter required" });
    }
    const readings = storage.getGlucoseReadings(date);
    res.json(readings);
  });

  app.get("/api/glucose/range", (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }
    const readings = storage.getGlucoseReadingsByDateRange(startDate, endDate);
    res.json(readings);
  });

  app.post("/api/glucose", (req, res) => {
    const parsed = insertGlucoseReadingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const reading = storage.addGlucoseReading(parsed.data);
    res.status(201).json(reading);
  });

  app.delete("/api/glucose/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deleteGlucoseReading(id);
    res.status(204).send();
  });

  // --- Settings ---
  app.get("/api/settings", (_req, res) => {
    const settings = storage.getSettings();
    res.json(settings);
  });

  app.patch("/api/settings", (req, res) => {
    const settings = storage.updateSettings(req.body);
    res.json(settings);
  });

  // --- USDA FoodData Central Search (proxy) ---
  // Uses the free DEMO_KEY by default. For production, get a key at https://fdc.nal.usda.gov/api-key-signup
  const USDA_API_KEY = process.env.USDA_API_KEY || "DEMO_KEY";

  app.get("/api/food-search", async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.trim().length < 2) {
      return res.json({ foods: [] });
    }
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=20&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "USDA API error" });
      }
      const data = await response.json() as any;

      // Transform USDA response into a simpler format
      const foods = (data.foods || []).map((food: any) => {
        const nutrients = food.foodNutrients || [];
        const getNutrient = (id: number) => {
          const n = nutrients.find((n: any) => n.nutrientId === id);
          return n ? n.value : 0;
        };
        return {
          fdcId: food.fdcId,
          name: food.description || food.lowercaseDescription || "",
          brand: food.brandOwner || food.brandName || null,
          category: food.foodCategory || null,
          servingSize: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : "100g",
          servingSizeValue: food.servingSize || 100,
          servingSizeUnit: food.servingSizeUnit || "g",
          // Nutrient IDs: 1008=Energy(kcal), 1003=Protein, 1004=Fat, 1005=Carbs, 1079=Fiber
          caloriesPer100g: getNutrient(1008),
          proteinPer100g: getNutrient(1003),
          fatPer100g: getNutrient(1004),
          carbsPer100g: getNutrient(1005),
          fiberPer100g: getNutrient(1079),
        };
      });

      res.json({ foods, totalHits: data.totalHits || 0 });
    } catch (e: any) {
      console.error("USDA search error:", e.message);
      res.status(500).json({ error: "Failed to search foods" });
    }
  });

  // --- Open Food Facts Barcode Lookup (proxy) ---
  app.get("/api/barcode/:code", async (req, res) => {
    const code = req.params.code;
    if (!code || code.length < 4) {
      return res.status(400).json({ error: "Invalid barcode" });
    }
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,brands,serving_size,serving_quantity,nutriments,image_front_url,categories`;
      const response = await fetch(url, {
        headers: { "User-Agent": "HouseMDFoodTracker/1.0 (contact@housemd.app)" }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: "Open Food Facts API error" });
      }
      const data = await response.json() as any;

      if (data.status !== 1 || !data.product) {
        return res.json({ found: false, product: null });
      }

      const p = data.product;
      const n = p.nutriments || {};

      // Open Food Facts provides per-100g values. If serving size is known, compute per-serving.
      const servingG = p.serving_quantity || 100;
      const factor = servingG / 100;

      res.json({
        found: true,
        product: {
          barcode: code,
          name: p.product_name || "Unknown Product",
          brand: p.brands || null,
          categories: p.categories || null,
          imageUrl: p.image_front_url || null,
          servingSize: p.serving_size || `${servingG}g`,
          servingQuantityG: servingG,
          // Per-serving values
          calories: Math.round((n["energy-kcal_100g"] || 0) * factor),
          protein: Math.round(((n.proteins_100g || 0) * factor) * 10) / 10,
          fat: Math.round(((n.fat_100g || 0) * factor) * 10) / 10,
          totalCarbs: Math.round(((n.carbohydrates_100g || 0) * factor) * 10) / 10,
          fiber: Math.round(((n.fiber_100g || 0) * factor) * 10) / 10,
          sugars: Math.round(((n.sugars_100g || 0) * factor) * 10) / 10,
          sodium: Math.round(((n.sodium_100g || 0) * factor * 1000) * 10) / 10, // mg
          // Per-100g raw values for reference
          per100g: {
            calories: n["energy-kcal_100g"] || 0,
            protein: n.proteins_100g || 0,
            fat: n.fat_100g || 0,
            carbs: n.carbohydrates_100g || 0,
            fiber: n.fiber_100g || 0,
          }
        }
      });
    } catch (e: any) {
      console.error("Barcode lookup error:", e.message);
      res.status(500).json({ error: "Failed to look up barcode" });
    }
  });

  // --- Seed sample data ---
  app.post("/api/seed", (_req, res) => {
    try {
      seedSampleData();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
