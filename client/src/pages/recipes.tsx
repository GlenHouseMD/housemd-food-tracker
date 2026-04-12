import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getRecipes, saveRecipe, deleteRecipe, updateRecipe } from "@/lib/db";
import type { Recipe, RecipeIngredient } from "@/lib/db";
import { addFoodEntry } from "@/lib/db";
import { format } from "date-fns";
import {
  Plus, Trash2, Search, ChefHat, Loader2, Edit2,
  Check, X, BookOpen, ArrowLeft
} from "lucide-react";

const USDA_KEY = "QKM9HMHZKVgeBnxCTsK22X8LAwETSEWpTYImOHjM";

// ─── Types ────────────────────────────────────────────────────────────────────

interface USDAFood {
  fdcId: number;
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number;
  servingSize: string;
  servingGrams: number;
}

function titleCase(str: string): string {
  return str.toLowerCase().split(/[\s,]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function calcTotals(ingredients: RecipeIngredient[]) {
  return ingredients.reduce((acc, ing) => ({
    totalCalories: acc.totalCalories + ing.calories,
    totalProtein: acc.totalProtein + ing.protein,
    totalFat: acc.totalFat + ing.fat,
    totalCarbs: acc.totalCarbs + ing.totalCarbs,
    totalFiber: acc.totalFiber + ing.fiber,
    totalNetCarbs: acc.totalNetCarbs + ing.netCarbs,
  }), { totalCalories: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0, totalFiber: 0, totalNetCarbs: 0 });
}

// ─── Ingredient search (USDA) ────────────────────────────────────────────────

function IngredientSearch({ onAdd }: { onAdd: (ing: RecipeIngredient) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<USDAFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<USDAFood | null>(null);
  const [grams, setGrams] = useState("100");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}&query=${encodeURIComponent(q)}&pageSize=20`);
      const data = await res.json() as any;
      setResults((data.foods || []).map((food: any) => {
        const n = food.foodNutrients || [];
        const get = (id: number) => n.find((x: any) => x.nutrientId === id)?.value ?? 0;
        let sg = food.servingSize || 100;
        return {
          fdcId: food.fdcId,
          name: food.description || "",
          brand: food.brandOwner || food.brandName || null,
          caloriesPer100g: get(1008),
          proteinPer100g: get(1003),
          fatPer100g: get(1004),
          carbsPer100g: get(1005),
          fiberPer100g: get(1079),
          servingSize: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : "100g",
          servingGrams: sg,
        };
      }));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setSelected(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(e.target.value), 400);
  }

  function select(food: USDAFood) {
    setSelected(food);
    setGrams(String(Math.round(food.servingGrams) || 100));
    setResults([]);
    setQuery(titleCase(food.name));
  }

  function addIngredient() {
    if (!selected) return;
    const g = parseFloat(grams) || 100;
    const f = g / 100;
    const r1 = (v: number) => Math.round(v * 10) / 10;
    onAdd({
      name: titleCase(selected.name) + (selected.brand ? ` (${selected.brand})` : ""),
      servingSize: `${g}g`,
      calories: Math.round(selected.caloriesPer100g * f),
      protein: r1(selected.proteinPer100g * f),
      fat: r1(selected.fatPer100g * f),
      totalCarbs: r1(selected.carbsPer100g * f),
      fiber: r1(selected.fiberPer100g * f),
      netCarbs: r1(Math.max(0, selected.carbsPer100g * f - selected.fiberPer100g * f)),
    });
    setQuery(""); setSelected(null); setGrams("100"); setResults([]);
  }

  return (
    <div className="space-y-2">
      {/* Results above, input below (keyboard-safe) */}
      {results.length > 0 && (
        <div className="max-h-44 overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
          {results.map((food) => (
            <button key={food.fdcId} onClick={() => select(food)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 active:bg-muted flex justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{titleCase(food.name)}</p>
                {food.brand && <p className="text-[10px] text-muted-foreground">{food.brand}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{Math.round(food.caloriesPer100g)} kcal/100g</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search ingredient (e.g., ground beef, eggs)..."
          value={query} onChange={handleChange} className="pl-9" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {selected && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Amount (grams)</Label>
            <Input type="number" value={grams} onChange={e => setGrams(e.target.value)}
              className="mt-1" inputMode="decimal" min="1" />
          </div>
          <Button onClick={addIngredient} className="shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Recipe Builder / Editor Dialog ──────────────────────────────────────────

function RecipeDialog({ recipe, open, onClose }: {
  recipe?: Recipe;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!recipe;
  const [name, setName] = useState(recipe?.name ?? "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients ?? []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totals = calcTotals(ingredients);
      const now = new Date().toISOString();
      if (isEdit) {
        return updateRecipe(recipe!.id, { name, servings: parseFloat(servings) || 1, ingredients, ...totals, updatedAt: now });
      } else {
        return saveRecipe({ name, servings: parseFloat(servings) || 1, ingredients, ...totals, createdAt: now, updatedAt: now });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: isEdit ? "Recipe updated" : "Recipe saved", description: name });
      onClose();
    },
  });

  const totals = calcTotals(ingredients);
  const srvs = parseFloat(servings) || 1;
  const perServing = {
    cal: Math.round(totals.totalCalories / srvs),
    prot: Math.round(totals.totalProtein / srvs * 10) / 10,
    fat: Math.round(totals.totalFat / srvs * 10) / 10,
    carbs: Math.round(totals.totalCarbs / srvs * 10) / 10,
    net: Math.round(totals.totalNetCarbs / srvs * 10) / 10,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg w-[96vw] flex flex-col" style={{ maxHeight: "min(90vh, 680px)" }}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recipe" : "Create Recipe"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Recipe name + servings */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Recipe Name</Label>
              <Input className="mt-1" placeholder="e.g., Keto Meatloaf"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Servings</Label>
              <Input className="mt-1" type="number" min="1" value={servings}
                onChange={e => setServings(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          {/* Add ingredient */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Add Ingredient</Label>
            <IngredientSearch onAdd={(ing) => setIngredients(prev => [...prev, ing])} />
          </div>

          {/* Ingredient list */}
          {ingredients.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                Ingredients ({ingredients.length})
              </Label>
              <div className="space-y-1">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ing.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ing.servingSize} · {ing.calories} kcal · {ing.protein}g protein · {ing.netCarbs}g net carbs</p>
                    </div>
                    <button onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nutrition summary */}
          {ingredients.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Per Serving ({srvs} servings total)</p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: "Calories", val: perServing.cal, unit: "kcal" },
                  { label: "Protein", val: perServing.prot, unit: "g" },
                  { label: "Fat", val: perServing.fat, unit: "g" },
                  { label: "Carbs", val: perServing.carbs, unit: "g" },
                  { label: "Net Carbs", val: perServing.net, unit: "g" },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-sm font-bold">{m.val}{m.unit === "kcal" ? "" : m.unit}</p>
                    {m.unit === "kcal" && <p className="text-[9px] text-muted-foreground">kcal</p>}
                    <p className="text-[9px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-3 border-t border-border shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!name.trim() || ingredients.length === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
            {isEdit ? "Update Recipe" : "Save Recipe"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Recipe Dialog ────────────────────────────────────────────────────────

function LogRecipeDialog({ recipe, open, onClose }: { recipe: Recipe; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [servingCount, setServingCount] = useState("1");
  const [mealType, setMealType] = useState("lunch");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);

  const srvs = parseFloat(servingCount) || 1;
  const factor = srvs / recipe.servings;
  const r1 = (v: number) => Math.round(v * 10) / 10;

  async function log() {
    setLoading(true);
    try {
      await addFoodEntry({
        date,
        mealType,
        name: recipe.name + (srvs !== 1 ? ` (${srvs} serving${srvs !== 1 ? "s" : ""})` : ""),
        servingSize: `${srvs} of ${recipe.servings} servings`,
        calories: Math.round(recipe.totalCalories * factor),
        protein: r1(recipe.totalProtein * factor),
        fat: r1(recipe.totalFat * factor),
        totalCarbs: r1(recipe.totalCarbs * factor),
        fiber: r1(recipe.totalFiber * factor),
        netCarbs: r1(recipe.totalNetCarbs * factor),
        tags: JSON.stringify(["recipe"]),
        source: "recipe",
        createdAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/food-entries"] });
      toast({ title: "Logged", description: `${recipe.name} added to ${mealType}` });
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm w-[92vw]">
        <DialogHeader>
          <DialogTitle className="text-base">Log {recipe.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" className="mt-1" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Servings</Label>
              <Input type="number" className="mt-1" value={servingCount} min="0.25" step="0.25"
                onChange={e => setServingCount(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Meal</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {["breakfast", "lunch", "dinner", "snack"].map(m => (
                <button key={m} onClick={() => setMealType(m)}
                  className={`py-1.5 rounded text-xs font-medium capitalize border transition-colors ${mealType === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 grid grid-cols-5 gap-2 text-center">
            {[
              { label: "kcal", val: Math.round(recipe.totalCalories * factor) },
              { label: "prot", val: r1(recipe.totalProtein * factor) + "g" },
              { label: "fat", val: r1(recipe.totalFat * factor) + "g" },
              { label: "carbs", val: r1(recipe.totalCarbs * factor) + "g" },
              { label: "net carbs", val: r1(recipe.totalNetCarbs * factor) + "g" },
            ].map(m => (
              <div key={m.label}>
                <p className="text-sm font-bold">{m.val}</p>
                <p className="text-[9px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={log} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Log It
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Recipes Page ────────────────────────────────────────────────────────

export default function RecipesPage() {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [logging, setLogging] = useState<Recipe | null>(null);

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["recipes"],
    queryFn: getRecipes,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRecipe(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipes"] }),
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4" data-testid="page-recipes">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" /> My Recipes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Save homemade meals and log them with one tap</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} data-testid="button-create-recipe">
          <Plus className="w-4 h-4 mr-1" /> New Recipe
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm font-medium">No recipes yet</p>
          <p className="text-xs text-muted-foreground">Tap "New Recipe" to build your first one</p>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Recipe
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => {
            const perSrv = recipe.servings > 0 ? {
              cal: Math.round(recipe.totalCalories / recipe.servings),
              prot: Math.round(recipe.totalProtein / recipe.servings * 10) / 10,
              net: Math.round(recipe.totalNetCarbs / recipe.servings * 10) / 10,
            } : { cal: 0, prot: 0, net: 0 };

            return (
              <Card key={recipe.id} className="shadow-sm" data-testid={`card-recipe-${recipe.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? "s" : ""} · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-medium">{perSrv.cal} kcal</span>
                        <span className="text-xs text-muted-foreground">{perSrv.prot}g protein</span>
                        <span className="text-xs text-muted-foreground">{perSrv.net}g net carbs</span>
                        <span className="text-[10px] text-muted-foreground">per serving</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs"
                        onClick={() => setEditing(recipe)} data-testid={`button-edit-recipe-${recipe.id}`}>
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" className="h-8 px-3 text-xs"
                        onClick={() => setLogging(recipe)} data-testid={`button-log-recipe-${recipe.id}`}>
                        Log
                      </Button>
                      <button onClick={() => {
                        if (confirm(`Delete "${recipe.name}"?`)) deleteMutation.mutate(recipe.id);
                      }} className="p-1.5 text-muted-foreground hover:text-destructive"
                        data-testid={`button-delete-recipe-${recipe.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <RecipeDialog open={creating} onClose={() => setCreating(false)} />
      {editing && <RecipeDialog recipe={editing} open={!!editing} onClose={() => setEditing(null)} />}
      {logging && <LogRecipeDialog recipe={logging} open={!!logging} onClose={() => setLogging(null)} />}
    </div>
  );
}
