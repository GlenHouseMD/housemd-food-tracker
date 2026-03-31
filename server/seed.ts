import { db } from "./db";
import { foodEntries, glucoseReadings } from "@shared/schema";
import { format, subDays } from "date-fns";

// Realistic low-carb food database for seeding
const sampleFoods = [
  // Breakfast items
  { name: "Scrambled Eggs (3 large)", serving: "3 eggs", cal: 234, protein: 18, fat: 17, carbs: 2, fiber: 0, meal: "breakfast" },
  { name: "Bacon (3 strips)", serving: "3 strips", cal: 129, protein: 9, fat: 10, carbs: 0, fiber: 0, meal: "breakfast" },
  { name: "Avocado (half)", serving: "1/2 medium", cal: 120, protein: 1.5, fat: 11, carbs: 6, fiber: 5, meal: "breakfast" },
  { name: "Greek Yogurt (plain)", serving: "170g", cal: 100, protein: 17, fat: 0.7, carbs: 6, fiber: 0, meal: "breakfast" },
  { name: "Bulletproof Coffee", serving: "12 oz", cal: 230, protein: 1, fat: 25, carbs: 0, fiber: 0, meal: "breakfast" },
  { name: "Almond Butter (2 tbsp)", serving: "2 tbsp", cal: 196, protein: 7, fat: 18, carbs: 6, fiber: 3, meal: "breakfast" },
  { name: "Smoked Salmon (3 oz)", serving: "85g", cal: 100, protein: 16, fat: 4, carbs: 0, fiber: 0, meal: "breakfast" },
  { name: "Cheese Omelet", serving: "3 eggs + 1oz cheddar", cal: 340, protein: 25, fat: 26, carbs: 2, fiber: 0, meal: "breakfast" },

  // Lunch items
  { name: "Grilled Chicken Breast", serving: "6 oz", cal: 284, protein: 53, fat: 6, carbs: 0, fiber: 0, meal: "lunch" },
  { name: "Caesar Salad (no croutons)", serving: "2 cups", cal: 180, protein: 8, fat: 14, carbs: 6, fiber: 2, meal: "lunch" },
  { name: "Salmon Fillet", serving: "6 oz", cal: 350, protein: 38, fat: 20, carbs: 0, fiber: 0, meal: "lunch" },
  { name: "Mixed Greens w/ Olive Oil", serving: "2 cups + 1 tbsp", cal: 140, protein: 2, fat: 14, carbs: 3, fiber: 2, meal: "lunch" },
  { name: "Turkey Lettuce Wraps", serving: "3 wraps", cal: 260, protein: 30, fat: 12, carbs: 8, fiber: 3, meal: "lunch" },
  { name: "Tuna Salad (mayo-based)", serving: "1 cup", cal: 380, protein: 33, fat: 24, carbs: 3, fiber: 0, meal: "lunch" },
  { name: "Broccoli (steamed)", serving: "1 cup", cal: 55, protein: 4, fat: 0.5, carbs: 11, fiber: 5, meal: "lunch" },

  // Dinner items
  { name: "Ribeye Steak (8 oz)", serving: "8 oz", cal: 544, protein: 46, fat: 40, carbs: 0, fiber: 0, meal: "dinner" },
  { name: "Pan-Seared Salmon", serving: "6 oz", cal: 367, protein: 34, fat: 24, carbs: 0, fiber: 0, meal: "dinner" },
  { name: "Roasted Asparagus", serving: "8 spears", cal: 60, protein: 4, fat: 3, carbs: 6, fiber: 3, meal: "dinner" },
  { name: "Cauliflower Mash", serving: "1 cup", cal: 100, protein: 3, fat: 7, carbs: 8, fiber: 3, meal: "dinner" },
  { name: "Grilled Chicken Thighs", serving: "2 thighs", cal: 340, protein: 36, fat: 20, carbs: 0, fiber: 0, meal: "dinner" },
  { name: "Spinach Sauteed in Butter", serving: "2 cups", cal: 120, protein: 4, fat: 10, carbs: 4, fiber: 2, meal: "dinner" },
  { name: "Shrimp Scampi (no pasta)", serving: "8 large", cal: 290, protein: 28, fat: 18, carbs: 3, fiber: 0, meal: "dinner" },
  { name: "Zucchini Noodles w/ Pesto", serving: "2 cups", cal: 180, protein: 5, fat: 14, carbs: 10, fiber: 3, meal: "dinner" },

  // Snacks
  { name: "Almonds (1 oz)", serving: "23 almonds", cal: 164, protein: 6, fat: 14, carbs: 6, fiber: 3.5, meal: "snack" },
  { name: "String Cheese", serving: "1 stick", cal: 80, protein: 7, fat: 6, carbs: 0.5, fiber: 0, meal: "snack" },
  { name: "Celery w/ Cream Cheese", serving: "3 stalks + 2 tbsp", cal: 120, protein: 3, fat: 10, carbs: 4, fiber: 2, meal: "snack" },
  { name: "Pork Rinds", serving: "1 oz", cal: 152, protein: 17, fat: 9, carbs: 0, fiber: 0, meal: "snack" },
  { name: "Dark Chocolate (85%)", serving: "1 oz", cal: 170, protein: 3, fat: 15, carbs: 10, fiber: 4, meal: "snack" },
  { name: "Hard-Boiled Egg", serving: "1 large", cal: 78, protein: 6, fat: 5, carbs: 0.5, fiber: 0, meal: "snack" },
  { name: "Macadamia Nuts", serving: "1 oz", cal: 204, protein: 2, fat: 22, carbs: 4, fiber: 2, meal: "snack" },
];

function randomPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getMealTag(totalCarbs: number, fiber: number, protein: number, calories: number): string[] {
  const netCarbs = totalCarbs - fiber;
  const tags: string[] = [];
  if (netCarbs <= 5) tags.push("ketogenic");
  else if (netCarbs <= 15) tags.push("low-carb");
  if (protein >= 25) tags.push("high-protein");
  if (tags.length === 0) tags.push("mixed");
  return tags;
}

export function seedSampleData() {
  const today = new Date();

  // Seed 30 days of data
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const date = format(subDays(today, daysAgo), "yyyy-MM-dd");

    const breakfastFoods = sampleFoods.filter(f => f.meal === "breakfast");
    const lunchFoods = sampleFoods.filter(f => f.meal === "lunch");
    const dinnerFoods = sampleFoods.filter(f => f.meal === "dinner");
    const snackFoods = sampleFoods.filter(f => f.meal === "snack");

    // 2-3 breakfast items
    const bItems = randomPick(breakfastFoods, 2 + Math.floor(Math.random() * 2));
    // 2-3 lunch items
    const lItems = randomPick(lunchFoods, 2 + Math.floor(Math.random() * 2));
    // 2-3 dinner items
    const dItems = randomPick(dinnerFoods, 2 + Math.floor(Math.random() * 2));
    // 1-2 snacks
    const sItems = randomPick(snackFoods, 1 + Math.floor(Math.random() * 2));

    const allItems = [
      ...bItems.map(f => ({ ...f, mealType: "breakfast" as const })),
      ...lItems.map(f => ({ ...f, mealType: "lunch" as const })),
      ...dItems.map(f => ({ ...f, mealType: "dinner" as const })),
      ...sItems.map(f => ({ ...f, mealType: "snack" as const })),
    ];

    for (const item of allItems) {
      const netCarbs = Math.max(0, item.carbs - item.fiber);
      const tags = getMealTag(item.carbs, item.fiber, item.protein, item.cal);
      
      db.insert(foodEntries).values({
        date,
        mealType: item.mealType,
        name: item.name,
        servingSize: item.serving,
        calories: item.cal,
        protein: item.protein,
        fat: item.fat,
        totalCarbs: item.carbs,
        fiber: item.fiber,
        netCarbs,
        tags: JSON.stringify(tags),
        source: "manual",
        createdAt: new Date().toISOString(),
      }).run();
    }

    // Glucose readings: fasting + 1-2 post-meal
    const fastingGlucose = 78 + Math.floor(Math.random() * 20); // 78-97 mg/dL
    db.insert(glucoseReadings).values({
      date,
      time: "07:00",
      type: "fasting",
      value: fastingGlucose,
      notes: null,
      createdAt: new Date().toISOString(),
    }).run();

    if (Math.random() > 0.3) {
      const postMealGlucose = 95 + Math.floor(Math.random() * 45); // 95-139 mg/dL
      db.insert(glucoseReadings).values({
        date,
        time: "13:00",
        type: "post-meal",
        value: postMealGlucose,
        notes: "After lunch",
        createdAt: new Date().toISOString(),
      }).run();
    }

    if (Math.random() > 0.5) {
      const postDinnerGlucose = 90 + Math.floor(Math.random() * 40);
      db.insert(glucoseReadings).values({
        date,
        time: "19:30",
        type: "post-meal",
        value: postDinnerGlucose,
        notes: "After dinner",
        createdAt: new Date().toISOString(),
      }).run();
    }
  }
}
