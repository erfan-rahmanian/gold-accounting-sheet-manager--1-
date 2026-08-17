import React, { useState, useEffect } from "react";
import { ShieldWarning, List, X, SignOut, ArrowClockwise, WifiSlash } from "@phosphor-icons/react";
import { AppState, AppSettings, Transaction, SheetDoc } from "./types";
import { formatCurrency, toPersianDigits } from "./utils";
import DashboardTab from "./components/DashboardTab";
import TransactionsTab from "./components/TransactionsTab";
import ReportsTab from "./components/ReportsTab";
import SettingsTab from "./components/SettingsTab";
import BackupRecoveryTab from "./components/BackupRecoveryTab";
import SpreadsheetTab from "./components/SpreadsheetTab";
import AuthGate from "./components/AuthGate";
import ProfileTab from "./components/ProfileTab";

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  type TabKey = "dashboard" | "transactions" | "reports" | "sheets" | "settings" | "backup" | "profile";
  const tabStorageKey = "gold_accounting_active_tab";
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem(tabStorageKey) as TabKey | null;
    return saved && ["dashboard", "transactions", "reports", "sheets", "settings", "backup", "profile"].includes(saved)
      ? saved
      : "dashboard";
  });
  const [fetching, setFetching] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  // ارسال‌ها پشت سر هم انجام می‌شوند تا ثبت سریع چند سند، داده‌ی قبلی را overwrite نکند.
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  // ---- احراز هویت ----
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupNeedsCode, setSignupNeedsCode] = useState(false);
  const [signupReason, setSignupReason] = useState<string | undefined>(undefined);

  /** کلید کش مرورگر برای هر کاربر جداست تا داده‌ی کاربران با هم قاطی نشود */
  const cacheKey = (user: string) => `gold_accounting_state__${user}`;


  // Scroll to hide logic on mobile
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(tabStorageKey, activeTab);
  }, [activeTab]);

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

  const migrateState = (state: AppState): AppState => {
    const rawPersons: any[] = state.settings.persons || [];
    const persons = rawPersons.map((p) =>
      typeof p === "string"
        ? { id: Math.random().toString(), name: p, initialGold: 0, initialIRR: 0, initialProfit: 0, note: "" }
        : { ...p, initialProfit: p.initialProfit || 0 }
    );
    return { ...state, settings: { ...state.settings, persons } };
  };

  const enforceCoins = (state: AppState): AppState => {
    const existing = state.settings.coins || [];
    const merged = [...existing];
    const hasCoin = (name: string) => merged.find(c => c.name === name);
    if (!hasCoin("سکه کامل")) {
      const ref = merged.find(c => {
        const n = c.name;
        return !n.includes("نیم") && !n.includes("ربع") && !n.includes("گرمی");
      });
      merged.push({ name: "سکه کامل", weight: ref ? ref.weight : 9.756 });
    }
    if (!hasCoin("نیم سکه")) {
      const ref = merged.find(c => c.name.includes("نیم"));
      merged.push({ name: "نیم سکه", weight: ref ? ref.weight : 4.8792 });
    }
    if (!hasCoin("ربع سکه")) {
      const ref = merged.find(c => c.name.includes("ربع"));
      merged.push({ name: "ربع سکه", weight: ref ? ref.weight : 2.440 });
    }
    return { ...state, settings: { ...state.settings, coins: merged } };
  };

  // Fetch initial data with custom offline/static host storage integration (e.g., Vercel fallback)
  const fetchData = async (user: string) => {
    setFetching(true);
    setNetworkError(null);
    try {
      const res = await fetch("/api/data");
      if (res.status === 401) {
        // نشست منقضی شده — برگرد به صفحه ورود
        setAuthUser(null);
        setAppState(null);
        return;
      }
      if (!res.ok) throw new Error("خطا در بارگذاری اطلاعات از پایگاه داده.");
      const data = await res.json();
      const fixed = migrateState(enforceCoins(data));
      setAppState(fixed);
      setIsLocalMode(false);
      localStorage.setItem(cacheKey(user), JSON.stringify(fixed));
    } catch (err: any) {
      console.warn("Could not connect to database server. Using localStorage fallback mode...", err);
      if (!navigator.onLine) setIsOffline(true);
      setIsLocalMode(true);
      const cached = localStorage.getItem(cacheKey(user));
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const fixed = migrateState(enforceCoins(parsed));
          setAppState(fixed);
          localStorage.setItem(cacheKey(user), JSON.stringify(fixed));
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
          transactions: [],
          sheets: []
        };
        setAppState(defaultState);
        localStorage.setItem(cacheKey(user), JSON.stringify(defaultState));
        setNetworkError(null);
      }
    } finally {
      setFetching(false);
    }
  };

  // بررسی نشست در شروع کار
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const info = await res.json().catch(() => null);
        if (!res.ok || !info?.signup) {
          // سرور جواب داد ولی خطا برگرداند — دلیلش را به کاربر نشان بده
          setSignupOpen(false);
          setSignupNeedsCode(false);
          setSignupReason(
            info?.error ||
              `سرور نتوانست وضعیت حساب‌ها را بخواند (کد ${res.status}). ` +
                "احتمالاً فضای ذخیره‌سازی Blob به پروژه وصل نشده یا متغیر AUTH_SECRET تنظیم نشده است."
          );
          setFetching(false);
          return;
        }
        setSignupOpen(!!info.signup.open);
        setSignupNeedsCode(!!info.signup.needsCode);
        setSignupReason(info.signup.reason);
        if (info.user) {
          setAuthUser(info.user);
        } else {
          setFetching(false);
        }
      } catch {
        // سرور در دسترس نیست — اگر قبلاً کاربری وارد شده بود، حالت محلی
        const last = localStorage.getItem("gold_accounting_last_user");
        if (last) {
          setIsLocalMode(true);
          setAuthUser(last);
        } else {
          setSignupOpen(true);
          setFetching(false);
        }
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // با ورود کاربر، داده‌های همان کاربر خوانده می‌شود
  useEffect(() => {
    if (!authUser) return;
    localStorage.setItem("gold_accounting_last_user", authUser);
    fetchData(authUser);
  }, [authUser]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });
    } catch {
      /* حتی اگر سرور جواب نداد، از حساب خارج شو */
    }
    localStorage.removeItem("gold_accounting_last_user");
    setAuthUser(null);
    setAppState(null);
    setMenuOpen(false);
    setActiveTab("dashboard");
  };

  /**
   * بعد از تغییر نام کاربری، کش مرورگر هم باید با نام جدید برچسب بخورد.
   *
   * کلید کش شامل نام کاربری است؛ اگر منتقلش نکنیم، در حالت آفلاین کاربر با
   * نام جدید یک دفتر خالی می‌بیند در حالی که داده‌هایش زیر کلید قدیمی مانده.
   */
  const handleUsernameChanged = (next: string) => {
    if (!next || next === authUser) return;
    if (authUser) {
      const cached = localStorage.getItem(cacheKey(authUser));
      if (cached) localStorage.setItem(cacheKey(next), cached);
      localStorage.removeItem(cacheKey(authUser));
    }
    localStorage.setItem("gold_accounting_last_user", next);
    // تغییر authUser خودش باعث خواندن دوباره‌ی داده‌ها از سرور می‌شود
    setAuthUser(next);
  };

  // ذخیره‌ی فوری در رابط کاربری و ارسال صف‌بندی‌شده به سرور در پس‌زمینه
  const saveState = (updatedState: AppState) => {
    setAppState(updatedState); // optimistic update
    if (authUser) localStorage.setItem(cacheKey(authUser), JSON.stringify(updatedState));

    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedState)
        });
        if (res.status === 401) {
          setAuthUser(null);
          setAppState(null);
          return;
        }
        if (!res.ok) throw new Error("مشکل در ذخیره‌سازی اطلاعات.");
        const result = await res.json();
        setAppState(result.data);
        setIsLocalMode(false);
      } catch (err: any) {
        console.warn("Server unavailable. Saving state locally in browser...", err);
        setIsLocalMode(true);
        if (!navigator.onLine) setIsOffline(true);
      }
    });
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

  const handleUpdateTransaction = async (transaction: Transaction) => {
    if (!appState) return;
    await saveState({
      ...appState,
      transactions: appState.transactions.map((tx) => tx.id === transaction.id ? transaction : tx)
    });
  };

  // Dedicated restore function for backups
  const handleRestoreState = async (restoredState: AppState) => {
    await saveState(restoredState);
  };

  // Spreadsheet (excel-like) sheets persistence
  const handleUpdateSheets = async (sheets: SheetDoc[]) => {
    if (!appState) return;
    await saveState({ ...appState, sheets });
  };

  if (fetching || !authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center gap-4 animate-fadeIn" dir="rtl">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">درحال فراخوانی اسناد و دفاتر حسابداری طلا...</p>
      </div>
    );
  }

  // بدون ورود، هیچ داده‌ای نمایش داده نمی‌شود
  if (!authUser) {
    return (
      <AuthGate
        signupOpen={signupOpen}
        signupNeedsCode={signupNeedsCode}
        signupReason={signupReason}
        onAuthenticated={(user) => {
          setSignupOpen(false);
          setAuthUser(user);
        }}
      />
    );
  }

  if (networkError || !appState) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6 text-center animate-fadeIn" dir="rtl">
        <ShieldWarning className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-base font-semibold text-rose-600 mb-3">{networkError || "کال بک دیتابیس با مشکل روبرو شد."}</p>
        <button
          onClick={() => fetchData(authUser)}
          className="bg-blue-600 text-white font-semibold px-6 py-3 rounded text-xs hover:bg-blue-700 cursor-pointer active:scale-95"
        >
          تلاش مجدد اتصال
        </button>
      </div>
    );
  }

  // آیکون‌های منو تصویرند، نه فونت‌آیکون؛ پس رنگشان با حالت فعال عوض نمی‌شود.
  // تشخیص گزینه‌ی فعال با همان پس‌زمینه‌ی کهربایی انجام می‌شود.
  const navItems = [
    { key: "dashboard", label: "داشبورد", icon: "/brand/dashboard-icon.png" },
    { key: "transactions", label: "ثبت سند", icon: "/brand/transaction-icon.png" },
    { key: "reports", label: "صورتحساب موجودی", icon: "/brand/reports-icon.png" },
    { key: "sheets", label: "صفحه گسترده (اکسل)", icon: "/brand/spreadsheet-icon.png" },
    { key: "settings", label: "ثبت مغازه و شخص", icon: "/brand/settings-icon.png" },
    { key: "backup", label: "بکاپ و بازیابی", icon: "/brand/backup-icon.png" },
    { key: "profile", label: "پروفایل و حساب کاربری", icon: "/brand/profile-icon.png" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between" dir="rtl">
      <div>
        {/* Dynamic Header with scroll-to-hide support on mobile */}
        <header className={`app-header fixed md:sticky top-0 right-0 left-0 z-50 bg-white border-b border-slate-200 px-3 py-2 md:px-4 md:py-3 transition-transform duration-300 ${showHeader ? "translate-y-0" : "-translate-y-full"}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 md:gap-4">
            {/* Left side: Hamburger + Title */}
            <div className="flex items-center gap-3">
              {/* Hamburger Button */}
              <button
                onClick={() => setMenuOpen(true)}
                className="header-icon-button p-1.5 bg-white hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer mr-0.5 min-h-[34px] min-w-[34px] flex items-center justify-center border border-slate-200"
                title="منوی اصلی"
              >
                <List className="w-[18px] h-[18px]" />
              </button>

              <div className="flex items-center gap-2">
                <img
                  src="/brand/logo.png"
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 hidden sm:block shrink-0 object-contain"
                />
                <h1 className="text-xs md:text-sm font-bold text-slate-900 tracking-tight leading-none animate-fadeIn">
                  سیستم مدیریت و حسابداری طلا
                </h1>
              </div>
            </div>

            {/* Right side: Database Synchronicity Status Card */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  localStorage.setItem(tabStorageKey, activeTab);
                  window.location.reload();
                }}
                className="header-icon-button p-1.5 bg-white hover:bg-blue-50 rounded text-slate-600 hover:text-blue-600 transition-colors cursor-pointer min-h-[30px] min-w-[30px] flex items-center justify-center border border-slate-200"
                title="رفرش صفحه"
                aria-label="رفرش صفحه"
              >
                <ArrowClockwise className="w-4 h-4" />
              </button>
              {isLocalMode ? (
                <span className="connection-dot bg-blue-500" title="حافظه محلی مرورگر فعال" aria-label="حافظه محلی مرورگر فعال"></span>
              ) : (
                <span className="connection-dot bg-emerald-500" title="متصل و همگام با سرور" aria-label="متصل و همگام با سرور"></span>
              )}
            </div>
          </div>
        </header>

        {isOffline && (
          <div className="fixed top-[48px] md:top-[68px] left-0 right-0 z-40 bg-rose-600 text-white px-4 py-2.5 text-center text-xs font-bold shadow-sm flex items-center justify-center gap-2" role="alert">
            <WifiSlash className="w-4 h-4" />
            اتصال اینترنت قطع است؛ تغییرات فعلاً در حافظه محلی مرورگر ذخیره می‌شوند.
          </div>
        )}

        {/* Scroll Margin Spacer only visible on mobile when header is fixed */}
        <div className="h-[48px] md:hidden"></div>

        {/* Slide-out Hamburger Drawer Menu (Sidebar) */}
        {menuOpen && (
          <div className="fixed inset-0 z-[100] no-print" dir="rtl">
            {/* Backdrop Overlay */}
            <div 
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
            ></div>

            {/* Nav Panel Drawer */}
            <div className="absolute right-0 top-0 bottom-0 w-[280px] max-w-full bg-slate-50 shadow-lg flex flex-col justify-between border-l border-slate-200 animate-slideInRight">
              {/*
                روی نمایشگرهای کوتاه (یا گوشی در حالت افقی) فهرست بلندتر از صفحه
                می‌شود؛ با اسکرول شدنِ همین بخش، بخش پایینی (حساب کاربری و خروج)
                همیشه سر جایش می‌ماند.
              */}
              <div className="min-h-0 overflow-y-auto">
                {/* Panel Header */}
                <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src="/brand/logo.png"
                      alt=""
                      width={32}
                      height={32}
                      className="w-8 h-8 shrink-0 object-contain"
                    />
                    <span className="text-xs font-bold text-slate-900">منوی هدایت حسابداری</span>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-1.5 bg-white border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                  >
                    <X className="w-[18px] h-[18px]" />
                  </button>
                </div>

                {/* Panel Nav Links */}
                <div className="p-2 space-y-0.5">
                  {navItems.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveTab(item.key);
                          setMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-xs cursor-pointer border-r-2 ${
                          isActive
                            ? "bg-white border-blue-600 text-blue-700 font-bold"
                            : "border-transparent text-slate-600 font-medium hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {/*
                          آیکون روی کارت سفید می‌نشیند تا رنگ‌های خودِ آیکون
                          در هر دو حالت فعال و غیرفعال خوانا بماند.
                        */}
                        <span className={`w-8 h-8 shrink-0 rounded flex items-center justify-center transition-colors ${
                          isActive ? "bg-blue-50 border border-blue-100" : "bg-white border border-slate-200"
                        }`}>
                          <img
                            src={item.icon}
                            alt=""
                            width={24}
                            height={24}
                            className="w-6 h-6 object-contain"
                          />
                        </span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drawer footer: حساب کاربری و خروج */}
              <div className="p-3 border-t border-slate-200 bg-white space-y-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div className="w-7 h-7 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-700 shrink-0 uppercase">
                    {authUser.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-medium leading-none mb-1">وارد شده با</div>
                    <div className="text-[11px] font-semibold text-slate-800 truncate" dir="ltr">{authUser}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded text-[11px] font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors"
                >
                  <SignOut className="w-3.5 h-3.5" />
                  خروج از حساب
                </button>
                <div className="text-center text-[10px] text-slate-400 font-medium pt-1">
                  نسخه آفلاین طلا PWA و اکسل
                </div>
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
                onUpdateTransaction={handleUpdateTransaction}
                onRemoveTransaction={handleRemoveTransaction}
              />
            )}

            {activeTab === "reports" && (
              <ReportsTab
                settings={appState.settings}
                transactions={appState.transactions}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === "sheets" && (
              <SpreadsheetTab
                sheets={appState.sheets}
                onChange={handleUpdateSheets}
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

            {activeTab === "profile" && (
              <ProfileTab
                username={authUser}
                onUsernameChanged={handleUsernameChanged}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
