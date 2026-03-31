import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useFoodEntries, useAddFoodEntry, useDeleteFoodEntry, useSettings } from "@/hooks/use-food-data";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays, subDays } from "date-fns";
import { Plus, Trash2, ChevronLeft, ChevronRight, Search, Camera, ScanBarcode, PenLine, Sparkles, Loader2, AlertCircle, CheckCircle2, Keyboard } from "lucide-react";
import { getMealTypeLabel, getTagColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ---- Types for API responses ----
interface USDAFood {
  fdcId: number;
  name: string;
  brand: string | null;
  category: string | null;
  servingSize: string;
  servingSizeValue: number;
  servingSizeUnit: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number;
}

interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  servingSize: string;
  calories: number;
  protein: number;
  fat: number;
  totalCarbs: number;
  fiber: number;
}

// ---- Helper: format USDA food name (title case) ----
function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---- The Add Food Dialog ----
function AddFoodDialog({ date, mealType, onClose }: { date: string; mealType: string; onClose: () => void }) {
  const [mode, setMode] = useState<"manual" | "search" | "barcode" | "photo">("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<USDAFood[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeProduct | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);

  // Manual entry state
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fiber, setFiber] = useState("");
  const [sourceType, setSourceType] = useState<string>("manual");

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);

  const addMutation = useAddFoodEntry();
  const { toast } = useToast();

  // ---- Debounced USDA search ----
  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await apiRequest("GET", `/api/food-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.foods || []);
      setSearchTotal(data.totalHits || 0);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (mode === "search" && searchQuery.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 400);
    } else {
      setSearchResults([]);
      setSearchTotal(0);
    }
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, mode, doSearch]);

  // ---- Select a food from search results (per 100g -> user can adjust) ----
  function selectUSDAFood(food: USDAFood) {
    const displayName = titleCase(food.name);
    const brandSuffix = food.brand ? ` (${food.brand})` : "";
    setName(displayName + brandSuffix);
    setServing("100g");
    setCal(String(Math.round(food.caloriesPer100g)));
    setProtein(String(Math.round(food.proteinPer100g * 10) / 10));
    setFat(String(Math.round(food.fatPer100g * 10) / 10));
    setCarbs(String(Math.round(food.carbsPer100g * 10) / 10));
    setFiber(String(Math.round(food.fiberPer100g * 10) / 10));
    setSourceType("search");
    setMode("manual");
  }

  // ---- Barcode lookup ----
  async function lookupBarcode(code: string) {
    if (!code || code.length < 4) return;
    setBarcodeLoading(true);
    setBarcodeError(null);
    setBarcodeResult(null);
    try {
      const res = await apiRequest("GET", `/api/barcode/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.found && data.product) {
        setBarcodeResult(data.product);
      } else {
        setBarcodeError("Product not found in the database. Try searching by name instead.");
      }
    } catch {
      setBarcodeError("Failed to look up barcode. Check your connection.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  function selectBarcodeProduct(product: BarcodeProduct) {
    const brandSuffix = product.brand ? ` (${product.brand})` : "";
    setName(product.name + brandSuffix);
    setServing(product.servingSize);
    setCal(String(product.calories));
    setProtein(String(product.protein));
    setFat(String(product.fat));
    setCarbs(String(product.totalCarbs));
    setFiber(String(product.fiber));
    setSourceType("barcode");
    setMode("manual");
  }

  // ---- Camera-based barcode scanning ----
  // Note: html5-qrcode uses localStorage internally which is blocked in sandboxed iframes.
  // Camera scanning works on real mobile devices. In the deployed preview, use manual barcode entry.
  async function startCameraScanner() {
    setBarcodeScanning(true);
    setBarcodeError(null);
    try {
      // Polyfill localStorage for sandboxed environments
      if (!window.localStorage) {
        const store: Record<string, string> = {};
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: (k: string) => store[k] || null,
            setItem: (k: string, v: string) => { store[k] = v; },
            removeItem: (k: string) => { delete store[k]; },
            clear: () => { Object.keys(store).forEach(k => delete store[k]); },
            get length() { return Object.keys(store).length; },
            key: (i: number) => Object.keys(store)[i] || null,
          },
          writable: true,
        });
      }
      const { Html5Qrcode } = await import("html5-qrcode");
      // Small delay for DOM to render
      await new Promise(r => setTimeout(r, 200));
      
      if (!scannerRef.current) return;
      
      const scanner = new Html5Qrcode("barcode-scanner-region");
      html5QrRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 120 },
          aspectRatio: 1.777,
        },
        (decodedText: string) => {
          // Barcode detected — stop scanner and look up
          scanner.stop().catch(() => {});
          html5QrRef.current = null;
          setBarcodeScanning(false);
          setBarcodeInput(decodedText);
          lookupBarcode(decodedText);
        },
        () => {} // ignore scan failures (normal during scanning)
      );
    } catch (err: any) {
      setBarcodeScanning(false);
      const msg = String(err?.message || err || "");
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setBarcodeError("Camera access denied. Please allow camera access in your browser settings, or enter the barcode manually below.");
      } else {
        setBarcodeError("Camera not available on this device. You can enter the barcode number manually below.");
      }
    }
  }

  function stopCameraScanner() {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current = null;
    }
    setBarcodeScanning(false);
  }

  // Cleanup scanner on unmount or mode change
  useEffect(() => {
    return () => { stopCameraScanner(); };
  }, [mode]);

  // ---- Submit ----
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
      source: sourceType,
      createdAt: new Date().toISOString(),
    }, {
      onSuccess: () => {
        toast({ title: "Food added", description: `${name} added to ${getMealTypeLabel(mealType)}` });
        onClose();
      },
    });
  }

  // ---- Photo handling (still demo) ----
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setPhotoAnalyzing(true);
      setTimeout(() => {
        setPhotoAnalyzing(false);
        // Demo: prompt user to switch to search
        toast({ title: "Photo analysis", description: "AI photo recognition requires a vision API key. Use Search or Barcode for now." });
      }, 1500);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-muted/50 p-1 rounded-lg">
        {[
          { key: "search", label: "Search", icon: Search },
          { key: "barcode", label: "Barcode", icon: ScanBarcode },
          { key: "manual", label: "Manual", icon: PenLine },
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

      {/* ===== SEARCH MODE (USDA FoodData Central) ===== */}
      {mode === "search" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search foods (e.g., chicken breast, almonds, yogurt)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-food-search"
              autoFocus
            />
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            Searching USDA FoodData Central — {searchTotal > 0 ? `${searchTotal.toLocaleString()} results` : "type to search"}
          </p>
          
          {searchLoading && (
            <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {searchResults.map((food, i) => (
              <button
                key={food.fdcId}
                onClick={() => selectUSDAFood(food)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-muted/50 transition-colors flex justify-between items-start gap-2"
                data-testid={`search-result-${i}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{titleCase(food.name)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {food.brand && <span className="text-[10px] text-muted-foreground">{food.brand}</span>}
                    {food.category && <span className="text-[10px] text-muted-foreground">· {food.category}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{Math.round(food.caloriesPer100g)}</p>
                  <p className="text-[9px] text-muted-foreground">kcal/100g</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== BARCODE MODE (Open Food Facts + Camera Scanner) ===== */}
      {mode === "barcode" && (
        <div className="space-y-3">
          {/* Camera scanner area */}
          {barcodeScanning ? (
            <div className="space-y-2">
              <div id="barcode-scanner-region" ref={scannerRef} className="w-full rounded-lg overflow-hidden" style={{ minHeight: 200 }} />
              <Button variant="outline" size="sm" onClick={stopCameraScanner} className="w-full">
                Stop Camera
              </Button>
            </div>
          ) : !barcodeResult ? (
            <div className="space-y-3">
              <Button onClick={startCameraScanner} className="w-full h-32 flex-col gap-2" variant="outline" data-testid="button-start-scanner">
                <ScanBarcode className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm">Tap to Scan Barcode</span>
                <span className="text-[10px] text-muted-foreground">Uses your device camera</span>
              </Button>
              
              {/* Manual barcode entry fallback */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground">or enter manually</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter barcode number..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value.replace(/\D/g, ""))}
                    className="pl-9"
                    inputMode="numeric"
                    data-testid="input-barcode-manual"
                  />
                </div>
                <Button onClick={() => lookupBarcode(barcodeInput)} disabled={barcodeInput.length < 4 || barcodeLoading} data-testid="button-barcode-lookup">
                  {barcodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Look Up"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Loading */}
          {barcodeLoading && (
            <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Looking up barcode...
            </div>
          )}

          {/* Error */}
          {barcodeError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 text-sm">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-muted-foreground">{barcodeError}</p>
            </div>
          )}

          {/* Result - confirm before adding */}
          {barcodeResult && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">Product found</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card">
                <p className="text-sm font-semibold">{barcodeResult.name}</p>
                {barcodeResult.brand && <p className="text-xs text-muted-foreground">{barcodeResult.brand}</p>}
                <p className="text-xs text-muted-foreground mt-1">Serving: {barcodeResult.servingSize}</p>
                <div className="grid grid-cols-5 gap-2 mt-2 text-center">
                  <div>
                    <p className="text-sm font-bold">{barcodeResult.calories}</p>
                    <p className="text-[9px] text-muted-foreground">kcal</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{barcodeResult.protein}g</p>
                    <p className="text-[9px] text-muted-foreground">protein</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{barcodeResult.fat}g</p>
                    <p className="text-[9px] text-muted-foreground">fat</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{barcodeResult.totalCarbs}g</p>
                    <p className="text-[9px] text-muted-foreground">carbs</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{barcodeResult.fiber}g</p>
                    <p className="text-[9px] text-muted-foreground">fiber</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => selectBarcodeProduct(barcodeResult)} className="flex-1" data-testid="button-confirm-barcode">
                  Confirm & Edit
                </Button>
                <Button variant="outline" onClick={() => { setBarcodeResult(null); setBarcodeInput(""); setBarcodeError(null); }}>
                  Scan Another
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Tap "Confirm & Edit" to review and adjust values before saving.
              </p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            Powered by Open Food Facts — 3M+ products worldwide
          </p>
        </div>
      )}

      {/* ===== PHOTO MODE (still demo) ===== */}
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
                AI food recognition requires a vision API key (GPT-4 Vision or Google Cloud Vision). Use Search or Barcode for now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <img src={photoPreview} alt="Food photo" className="w-full h-40 object-cover rounded-lg" />
              {photoAnalyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Analyzing...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== MANUAL ENTRY FORM ===== */}
      {mode === "manual" && (
        <div className="space-y-3">
          {sourceType !== "manual" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              Pre-filled from {sourceType === "search" ? "USDA database" : "barcode scan"} — edit any value before saving.
            </div>
          )}
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
              Net carbs: <span className="font-medium text-foreground">{Math.round(Math.max(0, (parseFloat(carbs) || 0) - (parseFloat(fiber) || 0)) * 10) / 10}g</span>
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

// ===== FOOD LOG PAGE =====
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
