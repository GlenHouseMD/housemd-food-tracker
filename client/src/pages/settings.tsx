import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSettings, useUpdateSettings, useSeedData } from "@/hooks/use-food-data";
import { Save, RotateCcw, Database, Zap, Shield, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const dietPresets: Record<string, { calories: number; protein: number; fat: number; totalCarbs: number; netCarbs: number }> = {
  "standard": { calories: 2000, protein: 100, fat: 80, totalCarbs: 250, netCarbs: 225 },
  "low-carb": { calories: 2000, protein: 150, fat: 100, totalCarbs: 50, netCarbs: 30 },
  "ketogenic": { calories: 1800, protein: 120, fat: 140, totalCarbs: 30, netCarbs: 20 },
  "high-protein": { calories: 2200, protein: 200, fat: 80, totalCarbs: 100, netCarbs: 80 },
};

export default function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const seedMutation = useSeedData();
  const { toast } = useToast();

  const [calorieTarget, setCalorieTarget] = useState("");
  const [proteinTarget, setProteinTarget] = useState("");
  const [fatTarget, setFatTarget] = useState("");
  const [totalCarbTarget, setTotalCarbTarget] = useState("");
  const [netCarbTarget, setNetCarbTarget] = useState("");
  const [dietMode, setDietMode] = useState("low-carb");
  const [glucoseTargetFasting, setGlucoseTargetFasting] = useState("");
  const [glucoseTargetPostMeal, setGlucoseTargetPostMeal] = useState("");

  useEffect(() => {
    if (settings) {
      setCalorieTarget(String(settings.calorieTarget));
      setProteinTarget(String(settings.proteinTarget));
      setFatTarget(String(settings.fatTarget));
      setTotalCarbTarget(String(settings.totalCarbTarget));
      setNetCarbTarget(String(settings.netCarbTarget));
      setDietMode(settings.dietMode);
      setGlucoseTargetFasting(String(settings.glucoseTargetFasting || 90));
      setGlucoseTargetPostMeal(String(settings.glucoseTargetPostMeal || 120));
    }
  }, [settings]);

  function applyPreset(mode: string) {
    const preset = dietPresets[mode];
    if (!preset) return;
    setDietMode(mode);
    setCalorieTarget(String(preset.calories));
    setProteinTarget(String(preset.protein));
    setFatTarget(String(preset.fat));
    setTotalCarbTarget(String(preset.totalCarbs));
    setNetCarbTarget(String(preset.netCarbs));
  }

  function handleSave() {
    updateMutation.mutate({
      calorieTarget: parseFloat(calorieTarget) || 2000,
      proteinTarget: parseFloat(proteinTarget) || 150,
      fatTarget: parseFloat(fatTarget) || 100,
      totalCarbTarget: parseFloat(totalCarbTarget) || 50,
      netCarbTarget: parseFloat(netCarbTarget) || 30,
      dietMode,
      glucoseTargetFasting: parseFloat(glucoseTargetFasting) || 90,
      glucoseTargetPostMeal: parseFloat(glucoseTargetPostMeal) || 120,
    }, {
      onSuccess: () => {
        toast({ title: "Settings saved", description: "Your macro targets have been updated" });
      },
    });
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5" data-testid="page-settings">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Configure macro targets and preferences</p>
      </div>

      {/* Diet mode */}
      <Card className="shadow-sm" data-testid="card-diet-mode">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm font-medium">Diet Mode</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Select value={dietMode} onValueChange={applyPreset}>
            <SelectTrigger data-testid="select-diet-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="low-carb">Low Carb</SelectItem>
              <SelectItem value="ketogenic">Ketogenic</SelectItem>
              <SelectItem value="high-protein">High Protein</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-2">
            Selecting a preset will update targets below. Choose "Custom" to set your own.
          </p>
        </CardContent>
      </Card>

      {/* Macro targets */}
      <Card className="shadow-sm" data-testid="card-macro-targets">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm font-medium">Daily Macro Targets</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Calories (kcal)</Label>
              <Input type="number" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} data-testid="input-calorie-target" />
            </div>
            <div>
              <Label className="text-xs">Protein (g)</Label>
              <Input type="number" value={proteinTarget} onChange={(e) => setProteinTarget(e.target.value)} data-testid="input-protein-target" />
            </div>
            <div>
              <Label className="text-xs">Fat (g)</Label>
              <Input type="number" value={fatTarget} onChange={(e) => setFatTarget(e.target.value)} data-testid="input-fat-target" />
            </div>
            <div>
              <Label className="text-xs">Total Carbs (g)</Label>
              <Input type="number" value={totalCarbTarget} onChange={(e) => setTotalCarbTarget(e.target.value)} data-testid="input-carb-target" />
            </div>
            <div>
              <Label className="text-xs">Net Carbs (g)</Label>
              <Input type="number" value={netCarbTarget} onChange={(e) => setNetCarbTarget(e.target.value)} data-testid="input-net-carb-target" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glucose targets */}
      <Card className="shadow-sm" data-testid="card-glucose-targets">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm font-medium">Glucose Targets</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fasting Target (mg/dL)</Label>
              <Input type="number" value={glucoseTargetFasting} onChange={(e) => setGlucoseTargetFasting(e.target.value)} data-testid="input-glucose-fasting-target" />
            </div>
            <div>
              <Label className="text-xs">Post-Meal Target (mg/dL)</Label>
              <Input type="number" value={glucoseTargetPostMeal} onChange={(e) => setGlucoseTargetPostMeal(e.target.value)} data-testid="input-glucose-postmeal-target" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Reference lines will appear on metabolic charts at these values.
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full" data-testid="button-save-settings">
        <Save className="w-4 h-4 mr-2" />
        {updateMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>

      <Separator />

      {/* API connections placeholder */}
      <Card className="shadow-sm border-dashed" data-testid="card-api-connections">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm font-medium">API Connections</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {[
            { name: "Nutritionix API", desc: "Food database search", status: "Demo mode", icon: Zap },
            { name: "Open Food Facts", desc: "Barcode lookup", status: "Not connected", icon: Shield },
            { name: "GPT-4 Vision", desc: "Food photo recognition", status: "Demo mode", icon: Wifi },
            { name: "CGM Integration", desc: "Dexcom / Libre API", status: "Coming soon", icon: Database },
          ].map((api) => {
            const Icon = api.icon;
            return (
              <div key={api.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{api.name}</p>
                    <p className="text-[11px] text-muted-foreground">{api.desc}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{api.status}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Seed data */}
      <Card className="shadow-sm" data-testid="card-seed-data">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm font-medium">Sample Data</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">
            Load 30 days of realistic sample food entries and glucose readings to demo the app.
          </p>
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed">
            <Database className="w-4 h-4 mr-2" />
            {seedMutation.isPending ? "Loading..." : "Load Sample Data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
