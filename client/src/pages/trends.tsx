import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useFoodEntriesRange, useSettings, aggregateDailyTotals } from "@/hooks/use-food-data";
import { format, subDays, eachDayOfInterval } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from "recharts";

const today = new Date();

function useTrendData(days: number) {
  const startDate = format(subDays(today, days - 1), "yyyy-MM-dd");
  const endDate = format(today, "yyyy-MM-dd");
  const { data: entries, isLoading } = useFoodEntriesRange(startDate, endDate);
  const { data: settings } = useSettings();

  const dailyTotals = entries ? aggregateDailyTotals(entries) : {};

  const allDays = eachDayOfInterval({
    start: subDays(today, days - 1),
    end: today,
  });

  const chartData = allDays.map(d => {
    const dateStr = format(d, "yyyy-MM-dd");
    const t = dailyTotals[dateStr] || { calories: 0, protein: 0, fat: 0, totalCarbs: 0, netCarbs: 0 };
    return {
      date: dateStr,
      label: days <= 7 ? format(d, "EEE") : format(d, "M/d"),
      calories: Math.round(t.calories),
      protein: Math.round(t.protein),
      fat: Math.round(t.fat),
      totalCarbs: Math.round(t.totalCarbs),
      netCarbs: Math.round(t.netCarbs),
    };
  });

  // Compute averages
  const nonZeroDays = chartData.filter(d => d.calories > 0);
  const avg = nonZeroDays.length > 0 ? {
    calories: Math.round(nonZeroDays.reduce((s, d) => s + d.calories, 0) / nonZeroDays.length),
    protein: Math.round(nonZeroDays.reduce((s, d) => s + d.protein, 0) / nonZeroDays.length),
    fat: Math.round(nonZeroDays.reduce((s, d) => s + d.fat, 0) / nonZeroDays.length),
    totalCarbs: Math.round(nonZeroDays.reduce((s, d) => s + d.totalCarbs, 0) / nonZeroDays.length),
    netCarbs: Math.round(nonZeroDays.reduce((s, d) => s + d.netCarbs, 0) / nonZeroDays.length),
  } : { calories: 0, protein: 0, fat: 0, totalCarbs: 0, netCarbs: 0 };

  return { chartData, avg, settings, isLoading };
}

const tooltipStyle = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

function CalorieChart({ data, target, avg }: { data: any[]; target: number; avg: number }) {
  return (
    <div className="h-[220px] md:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="calGradTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          {target > 0 && <ReferenceLine y={target} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "Target", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />}
          <Area type="monotone" dataKey="calories" stroke="hsl(var(--chart-2))" fill="url(#calGradTrend)" strokeWidth={2} dot={{ r: 3 }} name="Calories" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MacroChart({ data, settings }: { data: any[]; settings: any }) {
  return (
    <div className="h-[220px] md:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="protein" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} name="Protein (g)" />
          <Bar dataKey="fat" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} name="Fat (g)" />
          <Bar dataKey="netCarbs" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} name="Net Carbs (g)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NetCarbsChart({ data, target }: { data: any[]; target: number }) {
  return (
    <div className="h-[220px] md:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          {target > 0 && <ReferenceLine y={target} stroke="hsl(var(--chart-4))" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "Target", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />}
          <Line type="monotone" dataKey="netCarbs" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} name="Net Carbs (g)" />
          <Line type="monotone" dataKey="totalCarbs" stroke="hsl(var(--chart-5))" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" name="Total Carbs (g)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Trends() {
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");
  const days = parseInt(period);
  const { chartData, avg, settings, isLoading } = useTrendData(days);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5" data-testid="page-trends">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Trends</h2>
          <p className="text-sm text-muted-foreground">Macro and calorie trends over time</p>
        </div>
      </div>

      {/* Period selector */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList className="grid w-full max-w-xs grid-cols-3">
          <TabsTrigger value="7" data-testid="tab-7day">7 Day</TabsTrigger>
          <TabsTrigger value="14" data-testid="tab-14day">14 Day</TabsTrigger>
          <TabsTrigger value="30" data-testid="tab-30day">30 Day</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Averages row */}
      {!isLoading && (
        <div className="grid grid-cols-5 gap-2" data-testid="trend-averages">
          {[
            { label: "Avg Cal", value: avg.calories, unit: "" },
            { label: "Avg Protein", value: avg.protein, unit: "g" },
            { label: "Avg Fat", value: avg.fat, unit: "g" },
            { label: "Avg Carbs", value: avg.totalCarbs, unit: "g" },
            { label: "Avg Net", value: avg.netCarbs, unit: "g" },
          ].map(m => (
            <div key={m.label} className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-sm font-bold">{m.value}{m.unit}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Calorie trend */}
          <Card className="shadow-sm" data-testid="chart-calories">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Calories</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <CalorieChart data={chartData} target={settings?.calorieTarget || 0} avg={avg.calories} />
            </CardContent>
          </Card>

          {/* Macro breakdown */}
          <Card className="shadow-sm" data-testid="chart-macros">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Macro Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <MacroChart data={chartData} settings={settings} />
            </CardContent>
          </Card>

          {/* Net carbs trend */}
          <Card className="shadow-sm" data-testid="chart-net-carbs">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Carbohydrate Tracking</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <NetCarbsChart data={chartData} target={settings?.netCarbTarget || 0} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
