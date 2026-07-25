import React, { useState } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, GitMerge } from "lucide-react";
import { AppState, Transaction, Shop, Person, Coin } from "../types";
import { formatCurrency, formatWeight, toPersianDigits } from "../utils";

interface BackupRecoveryTabProps {
  appState: AppState;
  onRestoreState: (state: AppState) => Promise<void>;
}

// نتیجه‌ی merge برای نمایش به کاربر
interface MergeResult {
  addedTransactions: number;
  updatedTransactions: number;
  removedTransactions: number;
  skippedTransactions: number;
  addedShops: number;
  addedPersons: number;
  addedCoins: number;
}

/**
 * ادغام هوشمند بک‌آپ با state فعلی
 * - تراکنش‌های جدید (id جدید) → اضافه می‌شن
 * - تراکنش‌های ویرایش‌شده (id یکسان، محتوا متفاوت) → آپدیت می‌شن
 * - تراکنش‌های حذف‌شده (در بک‌آپ نیستن ولی در state فعلی هستن) → حذف می‌شن
 * - تراکنش‌های تکراری (id یکسان، محتوا کاملاً یکسان) → نادیده گرفته می‌شن
 * - shops/persons/coins جدید اضافه می‌شن، تکراری‌ها skip می‌شن
 */
function mergeBackupIntoState(current: AppState, incoming: AppState): { merged: AppState; result: MergeResult } {
  const result: MergeResult = {
    addedTransactions: 0,
    updatedTransactions: 0,
    removedTransactions: 0,
    skippedTransactions: 0,
    addedShops: 0,
    addedPersons: 0,
    addedCoins: 0,
  };

  // ---- ادغام تراکنش‌ها ----
  const currentMap = new Map<string, Transaction>(current.transactions.map(t => [t.id, t]));
  const incomingMap = new Map<string, Transaction>(incoming.transactions.map(t => [t.id, t]));

  // Map نهایی که نتیجه merge رو نگه می‌داره — کلید: id تراکنش
  const mergedMap = new Map<string, Transaction>();

  // 1) ابتدا همه تراکنش‌های state فعلی رو بذار داخل
  for (const [id, tx] of currentMap) {
    mergedMap.set(id, tx);
  }

  // 2) تراکنش‌های بک‌آپ رو بررسی کن
  for (const [id, incomingTx] of incomingMap) {
    const currentTx = currentMap.get(id);
    if (!currentTx) {
      // تراکنش جدید در بک‌آپ — اضافه کن
      mergedMap.set(id, incomingTx);
      result.addedTransactions++;
    } else {
      // id یکسانه — بررسی ویرایش (بدون rowNumber که ممکنه ترتیبی باشه)
      const { rowNumber: _r1, ...txA } = currentTx;
      const { rowNumber: _r2, ...txB } = incomingTx;
      if (JSON.stringify(txA) !== JSON.stringify(txB)) {
        // محتوا فرق داره — نسخه بک‌آپ (جدیدتر) رو جایگزین کن
        mergedMap.set(id, incomingTx);
        result.updatedTransactions++;
      } else {
        // کاملاً یکسانه — تکراری، نگه دار
        result.skippedTransactions++;
      }
    }
  }

  // 3) تراکنش‌هایی که در state فعلی بودن ولی در بک‌آپ نیستن
  //    اگه هر دو طرف بک‌آپ کامل دارن این یعنی حذف عمدی بوده
  //    → از mergedMap حذف کن و شمارش کن
  for (const [id] of currentMap) {
    if (!incomingMap.has(id)) {
      mergedMap.delete(id);
      result.removedTransactions++;
    }
  }

  // ترتیب ترکیبی: ترتیب بک‌آپ اول، بعد تراکنش‌های فقط-local که بک‌آپ ازشون خبر نداشت
  const incomingOrder = incoming.transactions.map(t => t.id);
  const localOnlyIds = [...currentMap.keys()].filter(id => !incomingMap.has(id) && mergedMap.has(id));
  const finalOrder = [...incomingOrder, ...localOnlyIds];
  const finalTransactions = finalOrder
    .filter(id => mergedMap.has(id))
    .map(id => mergedMap.get(id)!);

  // ---- ادغام shops ----
  const existingShopIds = new Set(current.settings.shops.map(s => s.id));
  const mergedShops = [...current.settings.shops];
  for (const shop of incoming.settings.shops) {
    if (!existingShopIds.has(shop.id)) {
      mergedShops.push(shop);
      result.addedShops++;
    }
  }

  // ---- ادغام persons ----
  const existingPersonIds = new Set(current.settings.persons.map(p => p.id));
  const mergedPersons = [...current.settings.persons];
  for (const person of incoming.settings.persons) {
    if (!existingPersonIds.has(person.id)) {
      mergedPersons.push(person);
      result.addedPersons++;
    }
  }

  // ---- ادغام coins ----
  const existingCoinNames = new Set(current.settings.coins.map(c => c.name));
  const mergedCoins = [...current.settings.coins];
  for (const coin of incoming.settings.coins) {
    if (!existingCoinNames.has(coin.name)) {
      mergedCoins.push(coin);
      result.addedCoins++;
    }
  }

  const merged: AppState = {
    settings: {
      ...current.settings,
      shops: mergedShops,
      persons: mergedPersons,
      coins: mergedCoins,
      // قیمت طلا رو از بک‌آپ جدیدتر بگیر اگه تنظیم شده
      currentGoldPrice: incoming.settings.currentGoldPrice || current.settings.currentGoldPrice,
    },
    transactions: finalTransactions,
  };

  return { merged, result };
}

export default function BackupRecoveryTab({ appState, onRestoreState }: BackupRecoveryTabProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  // 1. Excel (CSVUTF-8 BOM) Backup Export
  const exportToExcelCSV = () => {
    try {
      // BOM character for Persian alignment in MS Excel
      let csvContent = "\uFEFF";
      
      // Headers matching the ledger structure
      const headers = [
        "ردیف", "تاریخ", "مغازه", "نوع معامله", "همکار (شخص)", 
        "نوع سکه", "تعداد سکه", "وزن آبشده (گرم)", 
        "بستانکاری طلا (گرم)", "بدهکاری طلا (گرم)", 
        "بستانکاری ریال (ریال)", "بدهکاری ریال (ریال)", 
        "سود/زیان (ریال)", "توضیحات"
      ];
      
      csvContent += headers.join(",") + "\n";

      appState.transactions.forEach((tx, idx) => {
        const row = [
          idx + 1,
          tx.date || "",
          `"${(tx.shop || "").replace(/"/g, '""')}"`,
          `"${(tx.type || "").replace(/"/g, '""')}"`,
          `"${(tx.person || "").replace(/"/g, '""')}"`,
          `"${(tx.coinType || "").replace(/"/g, '""')}"`,
          tx.coinCount || 0,
          tx.goldWeight || 0,
          tx.goldCredit || 0,
          tx.goldDebit || 0,
          tx.irrCredit || 0,
          tx.irrDebit || 0,
          tx.profit || 0,
          `"${(tx.note || "").replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      // Blob creation to prompt instant native download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `دفتر_حسابداری_طلا_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg("فایل پشتیبان اکسل با موفقیت دانلود شد.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg("خطا در ایجاد فایل اکسل.");
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // 2. Full JSON Backup File Download (Restores settings, shops, transactions perfectly)
  const exportToJSON = () => {
    try {
      const dataStr = JSON.stringify(appState, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `پشتیبان_کل_حسابداری_طلا_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg("فایل پشتیبان کامل سیستم (JSON) با موفقیت دانلود شد.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg("خطا در ایجاد فایل پشتیبان.");
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // 3. Import JSON — merge یا replace بر اساس انتخاب کاربر
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setMergeResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;

        let importedState: AppState;
        try {
          importedState = JSON.parse(text);
          if (!importedState.settings || !Array.isArray(importedState.transactions)) {
            throw new Error("ساختار فایل نامعتبر است.");
          }
        } catch (jsonErr) {
          setErrorMsg("فرمت فایل باید یک فایل معتبر با پسوند .json پشتیبان سیستم باشد.");
          setLoading(false);
          return;
        }

        if (importMode === "merge") {
          // ادغام هوشمند: فقط تغییرات اعمال می‌شه
          const { merged, result } = mergeBackupIntoState(appState, importedState);
          await onRestoreState(merged);
          setMergeResult(result);

          const hasChanges =
            result.addedTransactions > 0 ||
            result.updatedTransactions > 0 ||
            result.removedTransactions > 0 ||
            result.addedShops > 0 ||
            result.addedPersons > 0 ||
            result.addedCoins > 0;

          if (hasChanges) {
            setSuccessMsg("ادغام بک‌آپ با موفقیت انجام شد. جزئیات تغییرات را در زیر ببینید.");
          } else {
            setSuccessMsg("بک‌آپ بررسی شد — هیچ تغییر جدیدی یافت نشد. اطلاعات شما به‌روز است.");
          }
        } else {
          // جایگزینی کامل (حالت قدیمی)
          await onRestoreState(importedState);
          setSuccessMsg("کل دفاتر مالی، تنظیمات، همکاران و مغازه‌ها با موفقیت بازیابی شدند.");
        }

        setTimeout(() => setSuccessMsg(null), 8000);
      } catch (err: any) {
        setErrorMsg(err.message || "خطا در خواندن فایل یا ناهمگونی ساختار داده.");
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Introduction Banner with Premium Golden Highlights */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-amber-500" />
          مرکز پشتیبان‌گیری و بازیابی دفاتر حسابداری طلا
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          داده‌های حسابداری طلا به صورت محلی در حافظه مرورگر امن شما و سرور محلی ذخیره می‌شوند. جهت جلوگیری از بروز حوادث غیرمترقبه یا پاک شدن کش‌ها، می‌توانید در چند ثانیه بک‌آپ کامل بگیرید و یا در صورت نیاز کل فاکتورها و دفاتر معین مغازه‌ها را بازگردانی کنید.
        </p>
      </div>

      {/* Trigger messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 text-xs font-bold animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export backups panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Download className="w-4.5 h-4.5 text-amber-500" />
            تهیه نسخه پشتیبان (خروجی گرفتن)
          </h3>

          <div className="space-y-3 text-xs font-semibold">
            {/* CSV Excel Backup */}
            <button
              onClick={exportToExcelCSV}
              className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer text-right min-h-[50px] active:scale-[0.98]"
            >
              <div className="space-y-0.5">
                <span className="font-extrabold text-slate-800 block text-xs">دانلود بک‌آپ اکسل (فرمت CSV)</span>
                <span className="text-[10px] text-slate-400 font-medium">مناسب بارگذاری مستقیم در مایکروسافت اکسل</span>
              </div>
              <FileSpreadsheet className="w-5 h-5 text-amber-600 shrink-0" />
            </button>

            {/* JSON Full Backup */}
            <button
              onClick={exportToJSON}
              className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer text-right min-h-[50px] active:scale-[0.98]"
            >
              <div className="space-y-0.5">
                <span className="font-extrabold text-slate-800 block text-xs">دانلود بک‌آپ کامل نرم‌افزار (.json)</span>
                <span className="text-[10px] text-slate-400 font-medium">شامل تنظیمات اولیه غرفه‌ها، اشخاص و کل اسناد</span>
              </div>
              <Download className="w-5 h-5 text-slate-600 shrink-0" />
            </button>
          </div>
        </div>

        {/* Restore backup panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Upload className="w-4.5 h-4.5 text-amber-500" />
            بازیابی اطلاعات (وارد کردن بک‌آپ)
          </h3>

          <div className="space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
              فایلی با پسوند <code className="text-amber-600 font-mono">.json</code> که قبلاً از این قسمت دانلود کرده‌اید را وارد کنید:
            </p>

            {/* انتخاب حالت import */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImportMode("merge")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center cursor-pointer ${
                  importMode === "merge"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                }`}
              >
                <GitMerge className={`w-4 h-4 ${importMode === "merge" ? "text-amber-600" : "text-slate-400"}`} />
                <span className="text-[10px] font-extrabold">ادغام هوشمند</span>
                <span className="text-[9px] font-medium leading-tight">فقط تغییرات اعمال می‌شه</span>
              </button>
              <button
                onClick={() => setImportMode("replace")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center cursor-pointer ${
                  importMode === "replace"
                    ? "border-rose-400 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${importMode === "replace" ? "text-rose-500" : "text-slate-400"}`} />
                <span className="text-[10px] font-extrabold">جایگزینی کامل</span>
                <span className="text-[9px] font-medium leading-tight">همه داده‌ها بازنویسی می‌شن</span>
              </button>
            </div>

            {/* توضیح حالت انتخاب‌شده */}
            {importMode === "merge" ? (
              <div className="bg-blue-50 p-3 border border-blue-100 rounded-xl text-[10px] text-blue-700 leading-relaxed font-semibold">
                <span className="font-extrabold block mb-1">حالت ادغام هوشمند:</span>
                تراکنش‌های جدید اضافه، ویرایش‌شده‌ها آپدیت، و حذف‌شده‌ها پاک می‌شن. موارد تکراری نادیده گرفته می‌شن. مغازه‌ها و اشخاص جدید هم اضافه می‌شن.
              </div>
            ) : (
              <div className="bg-rose-50 p-3 border border-rose-100 rounded-xl flex gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-rose-700 leading-relaxed font-semibold">
                  <span className="font-extrabold block mb-1">هشدار: جایگزینی کامل</span>
                  تمام اسناد موجود پاک و با فایل بک‌آپ جایگزین می‌شن. این عمل برگشت‌پذیر نیست.
                </div>
              </div>
            )}

            <div className="relative">
              <label className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl hover:border-amber-500 hover:bg-amber-500/5 transition-all cursor-pointer">
                {loading ? (
                  <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                )}
                <span className="text-xs font-extrabold text-slate-800">انتخاب فایل پشتیبان (.json)</span>
                <span className="text-[9.5px] text-slate-400 font-medium mt-1">یا فایل را به این بخش بکشید و رها کنید</span>

                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  disabled={loading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* نمایش جزئیات نتیجه merge */}
      {mergeResult && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3 animate-fadeIn">
          <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-amber-500" />
            جزئیات تغییرات اعمال‌شده
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
              <div className="text-xl font-black text-emerald-700">{toPersianDigits(mergeResult.addedTransactions)}</div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">سند جدید اضافه‌شده</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
              <div className="text-xl font-black text-blue-700">{toPersianDigits(mergeResult.updatedTransactions)}</div>
              <div className="text-[10px] text-blue-600 font-bold mt-0.5">سند ویرایش‌شده</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
              <div className="text-xl font-black text-rose-700">{toPersianDigits(mergeResult.removedTransactions)}</div>
              <div className="text-[10px] text-rose-600 font-bold mt-0.5">سند حذف‌شده</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
              <div className="text-xl font-black text-slate-500">{toPersianDigits(mergeResult.skippedTransactions)}</div>
              <div className="text-[10px] text-slate-400 font-bold mt-0.5">تکراری (نادیده‌گرفته‌شده)</div>
            </div>
            {(mergeResult.addedShops > 0 || mergeResult.addedPersons > 0 || mergeResult.addedCoins > 0) && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center col-span-2 sm:col-span-2">
                <div className="text-xl font-black text-amber-700">
                  {toPersianDigits(mergeResult.addedShops + mergeResult.addedPersons + mergeResult.addedCoins)}
                </div>
                <div className="text-[10px] text-amber-600 font-bold mt-0.5">
                  مغازه/شخص/سکه جدید اضافه‌شده
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
