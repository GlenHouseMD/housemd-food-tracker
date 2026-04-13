import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlucoseRange, useAddGlucoseReading, useSettings, useFoodEntriesRange, aggregateDailyTotals } from "@/hooks/use-food-data";
import { addGlucoseReading } from "@/lib/db";
import { queryClient } from "@/lib/queryClient";
import { format, subDays, eachDayOfInterval, parse, isValid } from "date-fns";
import { Activity, Plus, Droplets, TrendingDown, Upload, Info, CheckCircle2, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ComposedChart, Bar, Area
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const today = new Date();
const startDate30 = format(subDays(today, 29), "yyyy-MM-dd");
const endDate = format(today, "yyyy-MM-dd");

// ─── LibreView CSV Importer ──────────────────────────────────────────────────

type ImportResult = { imported: number; skipped: number; errors: string[] };

async function parseLibreViewCSV(text: string): Promise<ImportResult> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  
  // LibreView CSV has 1–2 header rows before the column row.
  // Find the header row by looking for "Device Timestamp" or "Time"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("device timestamp") || lower.includes("timestamp") || lower.includes("time")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { imported: 0, skipped: 0, errors: ["Could not find column headers. Make sure you're using the LibreView CSV export."] };
  }

  // Detect delimiter (comma or semicolon or tab)
  const headerLine = lines[headerIdx];
  const delim = headerLine.includes("\t") ? "\t" : headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(delim).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  // Find relevant column indices
  const tsIdx = headers.findIndex(h => h.includes("device timestamp") || h === "time");
  const recordTypeIdx = headers.findIndex(h => h.includes("record type"));
  const historicIdx = headers.findIndex(h => h.includes("historic glucose"));
  const scanIdx = headers.findIndex(h => h.includes("scan glucose"));

  if (tsIdx === -1) {
    return { imported: 0, skipped: 0, errors: ["Timestamp column not found. Expected 'Device Timestamp' column."] };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const dataLines = lines.slice(headerIdx + 1);
  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));

    // Parse timestamp — LibreView format: "04-03-2024 03:04 PM" or "2024-04-03 15:04"
    const rawTs = cols[tsIdx];
    if (!rawTs) { skipped++; continue; }

    let parsedDate: Date | null = null;
    // Try MM-DD-YYYY HH:mm AM/PM
    const d1 = parse(rawTs, "MM-dd-yyyy hh:mm a", new Date());
    if (isValid(d1)) parsedDate = d1;
    // Try MM-DD-YYYY HH:mm (24h)
    if (!parsedDate) { const d2 = parse(rawTs, "MM-dd-yyyy HH:mm", new Date()); if (isValid(d2)) parsedDate = d2; }
    // Try YYYY-MM-DD HH:mm
    if (!parsedDate) { const d3 = parse(rawTs, "yyyy-MM-dd HH:mm", new Date()); if (isValid(d3)) parsedDate = d3; }
    // Try DD/MM/YYYY HH:mm
    if (!parsedDate) { const d4 = parse(rawTs, "dd/MM/yyyy HH:mm", new Date()); if (isValid(d4)) parsedDate = d4; }

    if (!parsedDate) { skipped++; continue; }

    const dateStr = format(parsedDate, "yyyy-MM-dd");
    const timeStr = format(parsedDate, "HH:mm");

    // Determine glucose value and reading type
    const recordType = recordTypeIdx !== -1 ? cols[recordTypeIdx] : "";
    let glucoseVal: number | null = null;
    let readingType = "cgm";

    // Record type 0 = automatic CGM (historic), 1 = manual scan
    if (recordType === "0" || recordType === "") {
      const raw = historicIdx !== -1 ? cols[historicIdx] : "";
      if (raw) { glucoseVal = parseFloat(raw); readingType = "cgm"; }
    } else if (recordType === "1") {
      const raw = scanIdx !== -1 ? cols[scanIdx] : "";
      if (raw) { glucoseVal = parseFloat(raw); readingType = "post-meal"; }
    }

    if (!glucoseVal || isNaN(glucoseVal) || glucoseVal <= 0) { skipped++; continue; }

    // Convert mmol/L to mg/dL if value looks like mmol/L (< 35)
    if (glucoseVal < 35) glucoseVal = Math.round(glucoseVal * 18.0182);

    try {
      await addGlucoseReading({
        date: dateStr,
        time: timeStr,
        type: readingType,
        value: glucoseVal,
        notes: "Imported from LibreView",
        createdAt: parsedDate.toISOString(),
      });
      imported++;
    } catch {
      errors.push(`Failed to save reading for ${dateStr} ${timeStr}`);
    }
  }

  // Invalidate all glucose queries so charts refresh
  queryClient.invalidateQueries({ queryKey: ["/api/glucose"] });
  return { imported, skipped, errors };
}

function LibreViewImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setResult(null);
    try {
      const text = await file.text();
      const res = await parseLibreViewCSV(text);
      setResult(res);
      setStatus(res.errors.length > 0 && res.imported === 0 ? "error" : "done");
      if (res.imported > 0) {
        toast({ title: "Import complete", description: `${res.imported} glucose readings imported from LibreView` });
      }
    } catch (err: any) {
      setResult({ imported: 0, skipped: 0, errors: [err?.message || "Unknown error"] });
      setStatus("error");
    }
    // Reset input so same file can be re-imported
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card className="shadow-sm" data-testid="card-libreview-import">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Import from FreeStyle Libre / LibreView
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Export your glucose history from{" "}
          <a href="https://www.libreview.com" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
            libreview.com
          </a>{" "}
          (Glucose History → Download Glucose Data), then select the CSV file below.
        </p>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer flex-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/40 hover:border-primary/70 hover:bg-primary/5 transition-colors">
              <Upload className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-muted-foreground">
                {status === "parsing" ? "Importing..." : "Tap to select LibreView CSV file"}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFile}
              disabled={status === "parsing"}
              data-testid="input-libreview-csv"
            />
          </label>
        </div>

        {/* Result */}
        {result && status === "done" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {result.imported} readings imported
              </p>
              {result.skipped > 0 && (
                <p className="text-xs text-muted-foreground">{result.skipped} rows skipped (no glucose value)</p>
              )}
            </div>
          </div>
        )}
        {result && status === "error" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              {result.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">{e}</p>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground space-y-1">
          <p>• Supports FreeStyle Libre 1, 2, 3, and Lingo exports</p>
          <p>• Reads both CGM (automatic) and manual scan readings</p>
          <p>• Converts mmol/L to mg/dL automatically if needed</p>
          <p>• Existing readings are not deleted — imports are additive</p>
        </div>
      </CardContent>
    </Card>
  );
}

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
              <span className="text-xs font-medium text-muted-foreground">CGM Data</span>
            </div>
            <Badge variant="secondary" className="text-[10px] mt-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">LibreView import</Badge>
            <p className="text-[10px] text-muted-foreground mt-1">Import CSV below ↓</p>
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

          {/* LibreView CSV import */}
          <LibreViewImporter />
        </div>
      )}
    </div>
  );
}
