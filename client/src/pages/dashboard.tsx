import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFoodEntries, useFoodEntriesRange, useSettings, useSeedData, useGlucoseReadings } from "@/hooks/use-food-data";
import { format, subDays } from "date-fns";
import { Flame, Beef, Droplets, Wheat, Leaf, Plus, Activity, Database } from "lucide-react";
import { Link } from "wouter";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const today = format(new Date(), "yyyy-MM-dd");

export default function Dashboard() {
  const { data: entries, isLoading: loadingEntries } = useFoodEntries(today);
  const { data: settings, isLoading: loadingSettings } = useSettings();
  const { data: glucoseToday } = useGlucoseReadings(today);
  const seedMutation = useSeedData();

  // Get 7-day range for sparkline
  const startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const { data: rangeEntries } = useFoodEntriesRange(startDate, today);

  const totals = (entries || []).reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      totalCarbs: acc.totalCarbs + e.totalCarbs,
      netCarbs: acc.netCarbs + e.netCarbs,
    }),
    { calories: 0, protein: 0, fat: 0, totalCarbs: 0, netCarbs: 0 }
  );

  // 7-day trend data
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const dayEntries = (rangeEntries || []).filter(e => e.date === d);
    const dayCal = dayEntries.reduce((s, e) => s + e.calories, 0);
    const dayNet = dayEntries.reduce((s, e) => s + e.netCarbs, 0);
    return {
      day: format(subDays(new Date(), 6 - i), "EEE"),
      date: d,
      calories: Math.round(dayCal),
      netCarbs: Math.round(dayNet),
    };
  });

  const loading = loadingEntries || loadingSettings;
  const hasData = entries && entries.length > 0;
  const latestGlucose = glucoseToday && glucoseToday.length > 0 ? glucoseToday[glucoseToday.length - 1] : null;

  const macros = [
    { label: "Calories", value: totals.calories, target: settings?.calorieTarget || 2000, unit: "kcal", icon: Flame, color: "hsl(var(--chart-2))", bgClass: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "Protein", value: totals.protein, target: settings?.proteinTarget || 150, unit: "g", icon: Beef, color: "hsl(var(--chart-1))", bgClass: "bg-teal-50 dark:bg-teal-950/20" },
    { label: "Fat", value: totals.fat, target: settings?.fatTarget || 100, unit: "g", icon: Droplets, color: "hsl(var(--chart-3))", bgClass: "bg-purple-50 dark:bg-purple-950/20" },
    { label: "Total Carbs", value: totals.totalCarbs, target: settings?.totalCarbTarget || 50, unit: "g", icon: Wheat, color: "hsl(var(--chart-5))", bgClass: "bg-orange-50 dark:bg-orange-950/20" },
    { label: "Net Carbs", value: totals.netCarbs, target: settings?.netCarbTarget || 30, unit: "g", icon: Leaf, color: "hsl(var(--chart-4))", bgClass: "bg-green-50 dark:bg-green-950/20" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5" data-testid="page-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground" data-testid="text-dashboard-title">Dashboard</h2>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
        <div className="flex gap-2">
          {!hasData && !loading && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-data"
            >
              <Database className="w-4 h-4 mr-1.5" />
              {seedMutation.isPending ? "Loading..." : "Load Sample Data"}
            </Button>
          )}
          <Link href="/log">
            <Button size="sm" data-testid="button-add-food">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Food
            </Button>
          </Link>
        </div>
      </div>

      {/* Macro Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="macro-cards">
          {macros.map((m) => {
            const pct = m.target > 0 ? Math.min(100, (m.value / m.target) * 100) : 0;
            const remaining = Math.max(0, m.target - m.value);
            const Icon = m.icon;
            return (
              <Card key={m.label} className={`${m.bgClass} border-0 shadow-sm`}>
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color: m.color }} />
                    <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: m.color }} data-testid={`text-${m.label.toLowerCase().replace(/\s/g, '-')}-value`}>
                    {Math.round(m.value)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>
                  </div>
                  <Progress value={pct} className="h-1.5 mt-2 mb-1" />
                  <p className="text-[10px] text-muted-foreground">
                    {remaining > 0 ? `${Math.round(remaining)} ${m.unit} remaining` : "Target reached"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Glucose quick view + 7-day trend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Glucose card */}
        <Card className="shadow-sm" data-testid="card-glucose-quick">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Latest Glucose
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {latestGlucose ? (
              <div>
                <span className="text-2xl font-bold">{latestGlucose.value}</span>
                <span className="text-sm text-muted-foreground ml-1">mg/dL</span>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{latestGlucose.type} · {latestGlucose.time}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No readings today</p>
            )}
            <Link href="/metabolic">
              <Button variant="ghost" size="sm" className="mt-2 -ml-2 text-xs">View metabolic data →</Button>
            </Link>
          </CardContent>
        </Card>

        {/* 7-day calorie trend */}
        <Card className="md:col-span-2 shadow-sm" data-testid="card-calorie-trend">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium">7-Day Calorie Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area type="monotone" dataKey="calories" stroke="hsl(var(--chart-1))" fill="url(#calGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick meal summary */}
      {hasData && (
        <Card className="shadow-sm" data-testid="card-meal-summary">
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Today's Meals</CardTitle>
              <Link href="/log">
                <Button variant="ghost" size="sm" className="text-xs">View all →</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["breakfast", "lunch", "dinner", "snack"].map((meal) => {
                const mealEntries = (entries || []).filter(e => e.mealType === meal);
                const mealCal = mealEntries.reduce((s, e) => s + e.calories, 0);
                const icons: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🥜" };
                return (
                  <div key={meal} className="bg-muted/30 rounded-lg p-3" data-testid={`meal-summary-${meal}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{icons[meal]}</span>
                      <span className="text-xs font-medium capitalize text-muted-foreground">{meal}</span>
                    </div>
                    <p className="text-lg font-semibold">{Math.round(mealCal)}<span className="text-xs font-normal text-muted-foreground ml-0.5">kcal</span></p>
                    <p className="text-[10px] text-muted-foreground">{mealEntries.length} item{mealEntries.length !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
