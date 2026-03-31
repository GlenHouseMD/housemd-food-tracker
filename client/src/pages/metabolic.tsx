import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlucoseRange, useAddGlucoseReading, useSettings, useFoodEntriesRange, aggregateDailyTotals } from "@/hooks/use-food-data";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { Activity, Plus, Droplets, TrendingDown, TrendingUp, Minus, Info } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ComposedChart, Bar, Area
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const today = new Date();
const startDate30 = format(subDays(today, 29), "yyyy-MM-dd");
const endDate = format(today, "yyyy-MM-dd");

function AddGlucoseDialog({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(format(today, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(today, "HH:mm"));
  const [type, setType] = useState("fasting");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const addMutation = useAddGlucoseReading();
  const { toast } = useToast();

  function handleSubmit() {
    if (!value) return;
    addMutation.mutate({
      date,
      time,
      type,
      value: parseFloat(value),
      notes: notes || null,
      createdAt: new Date().toISOString(),
    }, {
      onSuccess: () => {
        toast({ title: "Reading added", description: `${value} mg/dL recorded` });
        onClose();
      },
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-glucose-date" />
        </div>
        <div>
          <Label className="text-xs">Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-glucose-time" />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-glucose-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fasting">Fasting</SelectItem>
              <SelectItem value="pre-meal">Pre-meal</SelectItem>
              <SelectItem value="post-meal">Post-meal</SelectItem>
              <SelectItem value="cgm">CGM Reading</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Value (mg/dL)</Label>
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="90" data-testid="input-glucose-value" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., After lunch" data-testid="input-glucose-notes" />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={!value || addMutation.isPending} className="w-full" data-testid="button-save-glucose">
        {addMutation.isPending ? "Saving..." : "Save Reading"}
      </Button>
    </div>
  );
}

export default function Metabolic() {
  const { data: readings, isLoading: loadingGlucose } = useGlucoseRange(startDate30, endDate);
  const { data: foodEntries } = useFoodEntriesRange(startDate30, endDate);
  const { data: settings } = useSettings();
  const [addOpen, setAddOpen] = useState(false);

  const allDays = eachDayOfInterval({ start: subDays(today, 29), end: today });
  const dailyFoodTotals = foodEntries ? aggregateDailyTotals(foodEntries) : {};

  // Glucose trend data
  const glucoseByDay = allDays.map(d => {
    const dateStr = format(d, "yyyy-MM-dd");
    const dayReadings = (readings || []).filter(r => r.date === dateStr);
    const fasting = dayReadings.find(r => r.type === "fasting");
    const postMeal = dayReadings.filter(r => r.type === "post-meal");
    const avgPostMeal = postMeal.length > 0 
      ? Math.round(postMeal.reduce((s, r) => s + r.value, 0) / postMeal.length)
      : null;
    
    return {
      date: dateStr,
      label: format(d, "M/d"),
      fasting: fasting?.value || null,
      postMeal: avgPostMeal,
      netCarbs: dailyFoodTotals[dateStr]?.netCarbs ? Math.round(dailyFoodTotals[dateStr].netCarbs) : null,
    };
  });

  // Correlation data: net carbs vs post-meal glucose
  const correlationData = glucoseByDay.filter(d => d.postMeal && d.netCarbs).map(d => ({
    netCarbs: d.netCarbs,
    postMealGlucose: d.postMeal,
    label: d.label,
  }));

  // Summary stats
  const allFasting = (readings || []).filter(r => r.type === "fasting");
  const allPostMeal = (readings || []).filter(r => r.type === "post-meal");
  const avgFasting = allFasting.length > 0 ? Math.round(allFasting.reduce((s, r) => s + r.value, 0) / allFasting.length) : null;
  const avgPostMeal = allPostMeal.length > 0 ? Math.round(allPostMeal.reduce((s, r) => s + r.value, 0) / allPostMeal.length) : null;

  const tooltipStyle = {
    contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
    labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5" data-testid="page-metabolic">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Metabolic Health</h2>
          <p className="text-sm text-muted-foreground">Glucose tracking and meal correlation</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-glucose">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Reading
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Log Glucose Reading</DialogTitle>
            </DialogHeader>
            <AddGlucoseDialog onClose={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-0 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Avg Fasting</span>
            </div>
            <p className="text-xl font-bold">{avgFasting ?? "—"}<span className="text-xs font-normal text-muted-foreground ml-1">mg/dL</span></p>
            <p className="text-[10px] text-muted-foreground">Target: {settings?.glucoseTargetFasting || 90}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950/20 border-0 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Avg Post-Meal</span>
            </div>
            <p className="text-xl font-bold">{avgPostMeal ?? "—"}<span className="text-xs font-normal text-muted-foreground ml-1">mg/dL</span></p>
            <p className="text-[10px] text-muted-foreground">Target: {"<"}{settings?.glucoseTargetPostMeal || 120}</p>
          </CardContent>
        </Card>
        <Card className="bg-teal-50 dark:bg-teal-950/20 border-0 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-medium text-muted-foreground">Readings</span>
            </div>
            <p className="text-xl font-bold">{(readings || []).length}</p>
            <p className="text-[10px] text-muted-foreground">Past 30 days</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-950/20 border-0 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">CGM Status</span>
            </div>
            <Badge variant="secondary" className="text-[10px] mt-1">Not connected</Badge>
            <p className="text-[10px] text-muted-foreground mt-1">Connect via API</p>
          </CardContent>
        </Card>
      </div>

      {loadingGlucose ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <div className="space-y-4">
          {/* Glucose trend chart */}
          <Card className="shadow-sm" data-testid="chart-glucose-trend">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">30-Day Glucose Trend</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[220px] md:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={glucoseByDay} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} domain={[60, 160]} />
                    <Tooltip {...tooltipStyle} />
                    {settings?.glucoseTargetFasting && (
                      <ReferenceLine y={settings.glucoseTargetFasting} stroke="hsl(var(--chart-2))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    )}
                    {settings?.glucoseTargetPostMeal && (
                      <ReferenceLine y={settings.glucoseTargetPostMeal} stroke="hsl(var(--chart-5))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    )}
                    <Line type="monotone" dataKey="fasting" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2.5 }} connectNulls name="Fasting (mg/dL)" />
                    <Line type="monotone" dataKey="postMeal" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 2.5 }} connectNulls name="Post-Meal (mg/dL)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Glucose + Net Carbs correlation */}
          <Card className="shadow-sm" data-testid="chart-glucose-carbs">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Post-Meal Glucose vs Net Carbs</CardTitle>
              <p className="text-[11px] text-muted-foreground">Each dot is a day. Lower-right = higher carbs with higher glucose response.</p>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[220px] md:h-[260px]">
                {correlationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="netCarbs" name="Net Carbs (g)" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} label={{ value: "Net Carbs (g)", position: "insideBottom", offset: -3, fontSize: 11 }} />
                      <YAxis dataKey="postMealGlucose" name="Post-Meal Glucose" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} domain={[70, 160]} label={{ value: "Glucose (mg/dL)", angle: -90, position: "insideLeft", offset: 20, fontSize: 11 }} />
                      <Tooltip {...tooltipStyle} />
                      <Scatter data={correlationData} fill="hsl(var(--chart-1))" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Need more data to show correlations
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Combined view: net carbs + glucose overlay */}
          <Card className="shadow-sm" data-testid="chart-combined">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Net Carbs vs Glycemic Response</CardTitle>
              <p className="text-[11px] text-muted-foreground">Bars show daily net carbs; line shows post-meal glucose.</p>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-[220px] md:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={glucoseByDay} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} interval={4} />
                    <YAxis yAxisId="carbs" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="glucose" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} domain={[60, 160]} />
                    <Tooltip {...tooltipStyle} />
                    <Bar yAxisId="carbs" dataKey="netCarbs" fill="hsl(var(--chart-4))" fillOpacity={0.5} radius={[2, 2, 0, 0]} name="Net Carbs (g)" />
                    <Line yAxisId="glucose" type="monotone" dataKey="postMeal" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 2 }} connectNulls name="Post-Meal Glucose" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* CGM placeholder */}
          <Card className="shadow-sm border-dashed" data-testid="card-cgm-placeholder">
            <CardContent className="p-6 text-center">
              <Activity className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-sm font-medium mb-1">CGM Integration Coming</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Connect a continuous glucose monitor (Dexcom, Libre, etc.) to see real-time glycemic data overlaid on your meal log. This feature will support data import via API or CSV upload.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
