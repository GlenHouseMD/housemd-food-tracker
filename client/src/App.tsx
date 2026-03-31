import { Switch, Route, Router, useLocation, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import FoodLog from "@/pages/food-log";
import Trends from "@/pages/trends";
import Metabolic from "@/pages/metabolic";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { LayoutDashboard, UtensilsCrossed, TrendingUp, Activity, SettingsIcon, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

function ThemeToggle() {
  const [dark, setDark] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <button
      data-testid="button-theme-toggle"
      onClick={() => setDark(d => !d)}
      className="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/log", icon: UtensilsCrossed, label: "Food Log" },
  { path: "/trends", icon: TrendingUp, label: "Trends" },
  { path: "/metabolic", icon: Activity, label: "Metabolic" },
  { path: "/settings", icon: SettingsIcon, label: "Settings" },
];

function BottomNav() {
  const [location] = useLocation();
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border pb-safe" data-testid="nav-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 px-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DesktopSidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card/50 h-screen sticky top-0" data-testid="nav-sidebar">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="HouseMD Food Tracker">
            <rect x="2" y="6" width="28" height="20" rx="4" stroke="currentColor" strokeWidth="2" className="text-primary" />
            <path d="M10 16h12M16 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
            <circle cx="16" cy="16" r="2" fill="currentColor" className="text-primary" />
          </svg>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">HouseMD</h1>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Food Tracker</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`} data-testid={`sidebar-${item.label.toLowerCase()}`}>
                <Icon className="w-4.5 h-4.5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/log" component={FoodLog} />
      <Route path="/trends" component={Trends} />
      <Route path="/metabolic" component={Metabolic} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-label="HouseMD">
              <rect x="2" y="6" width="28" height="20" rx="4" stroke="currentColor" strokeWidth="2" className="text-primary" />
              <path d="M10 16h12M16 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
              <circle cx="16" cy="16" r="2" fill="currentColor" className="text-primary" />
            </svg>
            <span className="text-sm font-semibold">HouseMD</span>
          </div>
          <ThemeToggle />
        </header>
        {/* Desktop header */}
        <header className="hidden md:flex items-center justify-end px-6 h-12 border-b border-border">
          <ThemeToggle />
        </header>
        <main className="flex-1 pb-20 md:pb-0">
          <AppRouter />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <AppLayout />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
