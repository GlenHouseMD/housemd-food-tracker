import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFoodEntries, useAddFoodEntry, useDeleteFoodEntry, useSettings } from "@/hooks/use-food-data";
import { format, addDays, subDays } from "date-fns";
import { Plus, Trash2, ChevronLeft, ChevronRight, Search, Camera, ScanBarcode, PenLine, Sparkles } from "lucide-react";
import { getMealTypeLabel, getTagColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Mock food search database
const foodDatabase = [
  { name: "Grilled Chicken Breast", serving: "6 oz", cal: 284, protein: 53, fat: 6, carbs: 0, fiber: 0 },
  { name: "Salmon Fillet", serving: "6 oz", cal: 350, protein: 38, fat: 20, carbs: 0, fiber: 0 },
  { name: "Scrambled Eggs (3 large)", serving: "3 eggs", cal: 234, protein: 18, fat: 17, carbs: 2, fiber: 0 },
  { name: "Avocado (half)", serving: "1/2 medium", cal: 120, protein: 1.5, fat: 11, carbs: 6, fiber: 5 },
  { name: "Broccoli (steamed)", serving: "1 cup", cal: 55, protein: 4, fat: 0.5, carbs: 11, fiber: 5 },
  { name: "Almonds (1 oz)", serving: "23 almonds", cal: 164, protein: 6, fat: 14, carbs: 6, fiber: 3.5 },
  { name: "Greek Yogurt (plain)", serving: "170g", cal: 100, protein: 17, fat: 0.7, carbs: 6, fiber: 0 },
  { name: "Ribeye Steak (8 oz)", serving: "8 oz", cal: 544, protein: 46, fat: 40, carbs: 0, fiber: 0 },
  { name: "Cauliflower Mash", serving: "1 cup", cal: 100, protein: 3, fat: 7, carbs: 8, fiber: 3 },
  { name: "String Cheese", serving: "1 stick", cal: 80, protein: 7, fat: 6, carbs: 0.5, fiber: 0 },
  { name: "Dark Chocolate (85%)", serving: "1 oz", cal: 170, protein: 3, fat: 15, carbs: 10, fiber: 4 },
  { name: "Bacon (3 strips)", serving: "3 strips", cal: 129, protein: 9, fat: 10, carbs: 0, fiber: 0 },
  { name: "Turkey Lettuce Wraps", serving: "3 wraps", cal: 260, protein: 30, fat: 12, carbs: 8, fiber: 3 },
  { name: "Spinach Sauteed in Butter", serving: "2 cups", cal: 120, protein: 4, fat: 10, carbs: 4, fiber: 2 },
  { name: "Hard-Boiled Egg", serving: "1 large", cal: 78, protein: 6, fat: 5, carbs: 0.5, fiber: 0 },
  { name: "Pork Rinds", serving: "1 oz", cal: 152, protein: 17, fat: 9, carbs: 0, fiber: 0 },
];

function AddFoodDialog({ date, mealType, onClose }: { date: string; mealType: string; onClose: () => void }) {
  const [mode, setMode] = useState<"manual" | "search" | "barcode" | "photo">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fiber, setFiber] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoResults, setPhotoResults] = useState<null | typeof foodDatabase[0][]>(null);
  const addMutation = useAddFoodEntry();
  const { toast } = useToast();

  const filteredFoods = foodDatabase.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function selectFood(food: typeof foodDatabase[0]) {
    setName(food.name);
    setServing(food.serving);
    setCal(String(food.cal));
    setProtein(String(food.protein));
    setFat(String(food.fat));
    setCarbs(String(food.carbs));
    setFiber(String(food.fiber));
    setMode("manual");
  }

  function handleSubmit() {
    if (!name || !cal) return;
    const totalCarbs = parseFloat(carbs) || 0;
    const fiberVal = parseFloat(fiber) || 0;
    const netCarbs = Math.max(0, totalCarbs - fiberVal);
    const proteinVal = parseFloat(protein) || 0;

    const tags: string[] = [];
    if (netCarbs <= 5) tags.push("ketogenic");
    else if (netCarbs <= 15) tags.push("low-carb");
    if (proteinVal >= 25) tags.push("high-protein");
    if (tags.length === 0) tags.push("mixed");

    addMutation.mutate({
      date,
      mealType,
      name,
      servingSize: serving || "1 serving",
      calories: parseFloat(cal) || 0,
      protein: proteinVal,
      fat: parseFloat(fat) || 0,
      totalCarbs,
      fiber: fiberVal,
      netCarbs,
      tags: JSON.stringify(tags),
      source: mode,
      createdAt: new Date().toISOString(),
    }, {
      onSuccess: () => {
        toast({ title: "Food added", description: `${name} added to ${getMealTypeLabel(mealType)}` });
        onClose();
      },
    });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setPhotoAnalyzing(true);
      // Simulate AI analysis delay
      setTimeout(() => {
        setPhotoAnalyzing(false);
        setPhotoResults([
          { name: "Grilled Chicken Breast", serving: "~6 oz", cal: 284, protein: 53, fat: 6, carbs: 0, fiber: 0 },
          { name: "Mixed Greens Salad", serving: "~2 cups", cal: 45, protein: 2, fat: 1, carbs: 6, fiber: 3 },
        ]);
      }, 2000);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-muted/50 p-1 rounded-lg">
        {[
          { key: "manual", label: "Manual", icon: PenLine },
          { key: "search", label: "Search", icon: Search },
          { key: "barcode", label: "Barcode", icon: ScanBarcode },
          { key: "photo", label: "Photo", icon: Camera },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key as any)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-md text-[11px] font-medium transition-colors ${
                mode === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search mode */}
      {mode === "search" && (
        <div className="space-y-3">
          <Input
            placeholder="Search foods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-food-search"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">
            Demo: searching local database. Connect Nutritionix or USDA API for full coverage.
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredFoods.map((food, i) => (
              <button
                key={i}
                onClick={() => selectFood(food)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-muted/50 transition-colors flex justify-between items-center"
                data-testid={`search-result-${i}`}
              >
                <div>
                  <p className="text-sm font-medium">{food.name}</p>
                  <p className="text-[11px] text-muted-foreground">{food.serving}</p>
                </div>
                <span className="text-xs text-muted-foreground">{food.cal} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barcode mode */}
      {mode === "barcode" && (
        <div className="text-center py-6 space-y-3">
          <div className="mx-auto w-48 h-48 bg-muted/30 rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
            <div className="text-center">
              <ScanBarcode className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Camera access required</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Barcode scanning requires a camera-enabled device and the Open Food Facts API. This is a demo placeholder — tap Search to find foods manually.
          </p>
          <Button variant="outline" size="sm" onClick={() => setMode("search")}>
            Use Search Instead
          </Button>
        </div>
      )}

      {/* Photo mode */}
      {mode === "photo" && (
        <div className="space-y-3">
          {!photoPreview ? (
            <div className="text-center py-4">
              <label className="cursor-pointer">
                <div className="mx-auto w-48 h-48 bg-muted/30 rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center hover:border-primary/40 transition-colors">
                  <div className="text-center">
                    <Camera className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Tap to take or upload photo</p>
                  </div>
                </div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} data-testid="input-photo-upload" />
              </label>
              <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">
                AI food recognition requires GPT-4 Vision or Google Cloud Vision API. Demo will simulate detection.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <img src={photoPreview} alt="Food photo" className="w-full h-40 object-cover rounded-lg" />
              {photoAnalyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Analyzing food photo...
                </div>
              )}
              {photoResults && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Detected foods — confirm or edit:</p>
                  {photoResults.map((food, i) => (
                    <button
                      key={i}
                      onClick={() => selectFood(food)}
                      className="w-full text-left p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      data-testid={`photo-result-${i}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{food.name}</p>
                          <p className="text-[11px] text-muted-foreground">{food.serving} · {food.cal} kcal</p>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Tap a detected food to add it with editable values.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual entry form (shown in manual mode or after selecting from search/photo) */}
      {mode === "manual" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Food Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Grilled Chicken" data-testid="input-food-name" />
            </div>
            <div>
              <Label className="text-xs">Serving Size</Label>
              <Input value={serving} onChange={(e) => setServing(e.target.value)} placeholder="e.g., 6 oz" data-testid="input-serving" />
            </div>
            <div>
              <Label className="text-xs">Calories</Label>
              <Input type="number" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="0" data-testid="input-calories" />
            </div>
            <div>
              <Label className="text-xs">Protein (g)</Label>
              <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" data-testid="input-protein" />
            </div>
            <div>
              <Label className="text-xs">Fat (g)</Label>
              <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" data-testid="input-fat" />
            </div>
            <div>
              <Label className="text-xs">Total Carbs (g)</Label>
              <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" data-testid="input-carbs" />
            </div>
            <div>
              <Label className="text-xs">Fiber (g)</Label>
              <Input type="number" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="0" data-testid="input-fiber" />
            </div>
          </div>
          {(carbs || fiber) && (
            <p className="text-xs text-muted-foreground">
              Net carbs: <span className="font-medium text-foreground">{Math.max(0, (parseFloat(carbs) || 0) - (parseFloat(fiber) || 0))}g</span>
            </p>
          )}
          <Button onClick={handleSubmit} disabled={!name || !cal || addMutation.isPending} className="w-full" data-testid="button-save-food">
            {addMutation.isPending ? "Adding..." : "Add to " + getMealTypeLabel(mealType)}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FoodLog() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: entries, isLoading } = useFoodEntries(dateStr);
  const { data: settings } = useSettings();
  const deleteMutation = useDeleteFoodEntry();
  const [addMeal, setAddMeal] = useState<string | null>(null);

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
  const icons: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🥜" };

  const totalCal = (entries || []).reduce((s, e) => s + e.calories, 0);
  const totalProtein = (entries || []).reduce((s, e) => s + e.protein, 0);
  const totalFat = (entries || []).reduce((s, e) => s + e.fat, 0);
  const totalNetCarbs = (entries || []).reduce((s, e) => s + e.netCarbs, 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4" data-testid="page-food-log">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))} data-testid="button-prev-day">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <h2 className="text-base font-semibold" data-testid="text-selected-date">{format(selectedDate, "EEEE, MMM d")}</h2>
          <p className="text-xs text-muted-foreground">{format(selectedDate, "yyyy")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))} data-testid="button-next-day">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Daily summary bar */}
      <div className="grid grid-cols-4 gap-2 bg-muted/30 rounded-lg p-3">
        <div className="text-center">
          <p className="text-lg font-bold">{Math.round(totalCal)}</p>
          <p className="text-[10px] text-muted-foreground">Calories</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{Math.round(totalProtein)}g</p>
          <p className="text-[10px] text-muted-foreground">Protein</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{Math.round(totalFat)}g</p>
          <p className="text-[10px] text-muted-foreground">Fat</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{Math.round(totalNetCarbs)}g</p>
          <p className="text-[10px] text-muted-foreground">Net Carbs</p>
        </div>
      </div>

      {/* Meal sections */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        mealTypes.map((meal) => {
          const mealEntries = (entries || []).filter(e => e.mealType === meal);
          const mealCal = mealEntries.reduce((s, e) => s + e.calories, 0);

          return (
            <Card key={meal} className="shadow-sm" data-testid={`card-meal-${meal}`}>
              <CardHeader className="pb-2 px-4 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icons[meal]}</span>
                    <CardTitle className="text-sm font-medium">{getMealTypeLabel(meal)}</CardTitle>
                    <span className="text-xs text-muted-foreground">{Math.round(mealCal)} kcal</span>
                  </div>
                  <Dialog open={addMeal === meal} onOpenChange={(open) => setAddMeal(open ? meal : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 px-2" data-testid={`button-add-${meal}`}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-base">Add to {getMealTypeLabel(meal)}</DialogTitle>
                      </DialogHeader>
                      <AddFoodDialog date={dateStr} mealType={meal} onClose={() => setAddMeal(null)} />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {mealEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No items logged</p>
                ) : (
                  <div className="space-y-1.5">
                    {mealEntries.map((entry) => {
                      const tags: string[] = entry.tags ? JSON.parse(entry.tags) : [];
                      return (
                        <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0" data-testid={`food-entry-${entry.id}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">{entry.servingSize}</span>
                              {tags.map(tag => (
                                <Badge key={tag} variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${getTagColor(tag)}`}>
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-3">
                            <div className="text-right">
                              <p className="text-sm font-medium">{Math.round(entry.calories)}</p>
                              <p className="text-[10px] text-muted-foreground">kcal</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteMutation.mutate({ id: entry.id, date: dateStr })}
                              data-testid={`button-delete-${entry.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
