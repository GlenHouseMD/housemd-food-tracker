import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertFoodEntrySchema, insertGlucoseReadingSchema } from "@shared/schema";
import { seedSampleData } from "./seed";

export async function registerRoutes(server: Server, app: Express) {
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
