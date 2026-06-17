import React, { useState, useEffect } from "react";
import { LayoutDashboard, Coins, Settings, ShieldAlert, LineChart, Database, RefreshCw, Smartphone, Menu, X } from "lucide-react";
import { AppState, AppSettings, Transaction } from "./types";
import { formatCurrency, toPersianDigits } from "./utils";
import DashboardTab from "./components/DashboardTab";
import TransactionsTab from "./components/TransactionsTab";
import ReportsTab from "./components/ReportsTab";
import SettingsTab from "./components/SettingsTab";
import BackupRecoveryTab from "./components/BackupRecoveryTab";

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions" | "reports" | "settings" | "backup">("dashboard");
  const [fetching, setFetching] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);

  // Scroll to hide logic on mobile
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (window.innerWidth < 768) {
        if (currentScrollY > 80 && currentScrollY > lastScrollY) {
          // Scrolling down -> hide header
          setShowHeader(false);
        } else {
          // Scrolling up or at top -> show header
          setShowHeader(true);
        }
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const DEFAULT_COINS = [
    { name: "سکه 86", weight: 9.756 },
    { name: "سکه پایین", weight: 9.756 },
    { name: "نیم سکه 86", weight: 4.8792 },
    { name: "نیم پایین", weight: 4.8792 },
    { name: "ربع سکه 86", weight: 2.440 },
    { name: "ربع پایین", weight: 2.440 }
  ];

  const enforceCoins = (state: AppState): AppState => ({
    ...state,
    settings: { ...state.settings, coins: DEFAULT_COINS }
  });

  // Fetch initial data with custom offline/static host storage integration (e.g., Vercel fallback)
  const fetchData = async () => {
    setFetching(true);
    setNetworkError(null);
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("خطا در بارگذاری اطلاعات از پایگاه داده مروگر.");
      const data = await res.json();
      const fixed = enforceCoins(data);
      setAppState(fixed);
      setIsLocalMode(false);
      localStorage.setItem("gold_accounting_state", JSON.stringify(fixed));
    } catch (err: any) {
      console.warn("Could not connect to database server. Using localStorage fallback mode...", err);
      setIsLocalMode(true);
      const cached = localStorage.getItem("gold_accounting_state");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const fixed = enforceCoins(parsed);
          setAppState(fixed);
          localStorage.setItem("gold_accounting_state", JSON.stringify(fixed));
          setNetworkError(null);
        } catch (e) {
          setNetworkError("خطا در بارگذاری اطلاعات پشتیبان محلی از مرورگر.");
        }
      } else {
        // Pristine default state when no cache and no backend are present
        const defaultState: AppState = {
          settings: {
            shops: [],
            persons: [],
            coins: DEFAULT_COINS,
            currentGoldPrice: 35000000,
            spreadsheetId: ""
          },
          transactions: []
        };
        setAppState(defaultState);
        localStorage.setItem("gold_accounting_state", JSON.stringify(defaultState));
        setNetworkError(null);
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Saves state to Express server (and mirrors to localStorage instantly)
  const saveState = async (updatedState: AppState) => {
    setAppState(updatedState); // optimistic update
    localStorage.setItem("gold_accounting_state", JSON.stringify(updatedState));

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedState)
      });
      if (!res.ok) throw new Error("مشکل در ذخیره‌سازی اطلاعات.");
      const result = await res.json();
      setAppState(result.data);
      setIsLocalMode(false);
    } catch (err: any) {
      console.warn("Express server unavailable. Saving state locally in browser...", err);
      setIsLocalMode(true);
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    if (!appState) return;
    const updated = {
      ...appState,
      settings: newSettings
    };
    await saveState(updated);
  };

  const handleAddTransaction = async (newTx: Transaction) => {
    if (!appState) return;
    const updatedTxs = [newTx, ...appState.transactions];
    const updated = {
      ...appState,
      transactions: updatedTxs
    };
    await saveState(updated);
  };

  const handleRemoveTransaction = async (id: string) => {
    if (!appState) return;
    const updatedTxs = appState.transactions.filter(t => t.id !== id);
    const updated = {
      ...appState,
      transactions: updatedTxs
    };
    await saveState(updated);
  };

  // Dedicated restore function for backups
  const handleRestoreState = async (restoredState: AppState) => {
    await saveState(restoredState);
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center gap-4 animate-fadeIn" dir="rtl">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">درحال فراخوانی اسناد و دفاتر حسابداری طلا...</p>
      </div>
    );
  }

  if (networkError || !appState) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6 text-center animate-fadeIn" dir="rtl">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-base font-bold text-rose-600 mb-3">{networkError || "کال بک دیتابیس با مشکل روبرو شد."}</p>
        <button
          onClick={fetchData}
          className="bg-amber-500 text-slate-950 font-extrabold px-6 py-3 rounded-2xl text-xs hover:bg-amber-400 cursor-pointer shadow-sm active:scale-95"
        >
          تلاش مجدد اتصال
        </button>
      </div>
    );
  }

  const navItems = [
    { key: "dashboard", label: "موجودی و داشبورد", icon: LayoutDashboard },
    { key: "transactions", label: "دفتر ثبت سند جدید", icon: Coins },
    { key: "reports", label: "تراز و صورت‌حساب‌ها", icon: LineChart },
    { key: "settings", label: "دفاتر و کالیبراسیون", icon: Settings },
    { key: "backup", label: "پشتیبان‌گیری و بازیابی", icon: Database },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between" dir="rtl">
      <div>
        {/* Dynamic Header with scroll-to-hide support on mobile */}
        <header className={`fixed md:sticky top-0 right-0 left-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-md transition-transform duration-300 ${showHeader ? "translate-y-0" : "-translate-y-full"}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Left side: Hamburger + Title */}
            <div className="flex items-center gap-3">
              {/* Hamburger Button */}
              <button
                onClick={() => setMenuOpen(true)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors cursor-pointer mr-0.5 min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200"
                title="منوی اصلی"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-xl hidden sm:flex items-center justify-center text-slate-950 shadow-sm shrink-0">
                  <Coins className="w-4.5 h-4.5 font-bold" />
                </div>
                <h1 className="text-xs md:text-sm font-black text-slate-900 tracking-tight leading-none animate-fadeIn">
                  سیستم مدیریت و حسابداری طلا
                </h1>
              </div>
            </div>

            {/* Right side: Database Synchronicity Status Card */}
            <div className="flex items-center gap-2">
              {isLocalMode ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-200 rounded-xl text-[10px] sm:text-xs font-black text-amber-805">
                  <span className="w-2 h-2 rounded-full bg-amber-550 block shrink-0 animate-pulse"></span>
                  <span>حافظه محلی مرورگر (فعال)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-250 rounded-xl text-[10px] sm:text-xs font-black text-emerald-805">
                  <span className="w-2 h-2 rounded-full bg-emerald-550 block shrink-0 animate-pulse"></span>
                  <span>متصل و همگام با سرور</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scroll Margin Spacer only visible on mobile when header is fixed */}
        <div className="h-[60px] md:hidden"></div>

        {/* Slide-out Hamburger Drawer Menu (Sidebar) */}
        {menuOpen && (
          <div className="fixed inset-0 z-[100] no-print" dir="rtl">
            {/* Backdrop Overlay */}
            <div 
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
            ></div>

            {/* Nav Panel Drawer */}
            <div className="absolute right-0 top-0 bottom-0 w-[280px] max-w-full bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-slideInRight">
              <div>
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-950 shadow-sm">
                      <Coins className="w-4 h-4 font-bold" />
                    </div>
                    <span className="text-xs font-black text-slate-900">منوی هدایت حسابداری</span>
                  </div>
                  <button 
                    onClick={() => setMenuOpen(false)}
                    className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-lg transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Panel Nav Links */}
                <div className="p-3 space-y-1">
                  {navItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveTab(item.key);
                          setMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-extrabold text-xs cursor-pointer ${
                          isActive 
                            ? "bg-amber-500 text-slate-950 shadow-sm" 
                            : "text-slate-650 hover:bg-slate-50 hover:text-slate-950"
                        }`}
                      >
                        <IconComp className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-950" : "text-amber-500"}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drawer footer containing version info */}
              <div className="p-4 border-t border-slate-150 bg-slate-50/50 text-center text-[10px] text-slate-400 font-bold">
                نسخه آفلاین طلا PWA و اکسل
              </div>
            </div>
          </div>
        )}

        {/* Main container */}
        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Tab content renderer inside custom container */}
          <div className="min-h-[450px]">
            {activeTab === "dashboard" && (
              <DashboardTab
                settings={appState.settings}
                transactions={appState.transactions}
              />
            )}

            {activeTab === "transactions" && (
              <TransactionsTab
                settings={appState.settings}
                transactions={appState.transactions}
                onAddTransaction={handleAddTransaction}
                onRemoveTransaction={handleRemoveTransaction}
              />
            )}

            {activeTab === "reports" && (
              <ReportsTab
                settings={appState.settings}
                transactions={appState.transactions}
              />
            )}

            {activeTab === "settings" && (
              <SettingsTab
                settings={appState.settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === "backup" && (
              <BackupRecoveryTab
                appState={appState}
                onRestoreState={handleRestoreState}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
