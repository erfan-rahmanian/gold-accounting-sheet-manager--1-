import React, { useState } from "react";
import { DownloadSimple, UploadSimple, FileXls, CheckCircle, Warning, ArrowsClockwise, GitMerge } from "@phosphor-icons/react";
import { AppState, Transaction, Shop, Person, Coin, SheetDoc } from "../types";
import { formatCurrency, formatWeight, toPersianDigits } from "../utils";
import { buildXlsx, downloadBlob } from "../xlsx";
import BrandIcon from "./BrandIcon";

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
  addedSheets: number;
  updatedSheets: number;
  removedSheets: number;
}

/**
 * ادغام هوشمند بک‌آپ با state فعلی
 * - تراکنش‌های جدید (id جدید) → اضافه می‌شن
 * - تراکنش‌های ویرایش‌شده (id یکسان، محتوا متفاوت) → آپدیت می‌شن
 * - تراکنش‌های حذف‌شده (در بک‌آپ نیستن ولی در state فعلی هستن) → حذف می‌شن
 * - تراکنش‌های تکراری (id یکسان، محتوا کاملاً یکسان) → نادیده گرفته می‌شن
 * - shops/persons/coins جدید اضافه می‌شن، تکراری‌ها skip می‌شن
 * - برگه‌های صفحه‌گسترده (اکسل داخلی) هم دقیقاً مثل تراکنش‌ها با id ادغام می‌شن
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
    addedSheets: 0,
    updatedSheets: 0,
    removedSheets: 0,
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

  // ---- ادغام برگه‌های صفحه‌گسترده (اکسل داخلی) ----
  // اگر فایل بک‌آپ قدیمی باشد و اصلاً فیلد sheets نداشته باشد، برگه‌های فعلی
  // دست‌نخورده می‌مانند (نبودِ فیلد یعنی «خبر ندارم»، نه «حذف کن»).
  const currentSheets = current.sheets ?? [];
  let mergedSheets: SheetDoc[] = currentSheets;

  if (Array.isArray(incoming.sheets)) {
    const currentSheetMap = new Map<string, SheetDoc>(currentSheets.map(s => [s.id, s]));
    const incomingSheetMap = new Map<string, SheetDoc>(incoming.sheets.map(s => [s.id, s]));
    const sheetMap = new Map<string, SheetDoc>(currentSheetMap);

    for (const [id, incomingSheet] of incomingSheetMap) {
      const currentSheet = currentSheetMap.get(id);
      if (!currentSheet) {
        sheetMap.set(id, incomingSheet);
        result.addedSheets++;
      } else if (JSON.stringify(currentSheet) !== JSON.stringify(incomingSheet)) {
        sheetMap.set(id, incomingSheet);
        result.updatedSheets++;
      }
    }

    for (const [id] of currentSheetMap) {
      if (!incomingSheetMap.has(id)) {
        sheetMap.delete(id);
        result.removedSheets++;
      }
    }

    // ترتیب برگه‌ها: اول ترتیب بک‌آپ، بعد برگه‌های فقط-محلی
    const sheetOrder = [
      ...incoming.sheets.map(s => s.id),
      ...currentSheets.map(s => s.id).filter(id => !incomingSheetMap.has(id) && sheetMap.has(id)),
    ];
    mergedSheets = sheetOrder.filter(id => sheetMap.has(id)).map(id => sheetMap.get(id)!);
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
    sheets: mergedSheets,
  };

  return { merged, result };
}

export default function BackupRecoveryTab({ appState, onRestoreState }: BackupRecoveryTabProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  // 1. Excel (.xlsx) Backup Export — راست‌به‌چپ، برخلاف CSV که همیشه چپ‌به‌راست باز می‌شد
  const exportToExcelCSV = () => {
    try {
      // Headers matching the ledger structure
      const headers = [
        "ردیف", "تاریخ", "مغازه", "نوع معامله", "همکار (شخص)",
        "نوع سکه", "تعداد سکه", "وزن آبشده (گرم)",
        "بستانکاری طلا (گرم)", "بدهکاری طلا (گرم)",
        "بستانکاری ریال (ریال)", "بدهکاری ریال (ریال)",
        "سود/زیان (ریال)", "توضیحات"
      ];

      const grid: (string | number)[][] = [headers];

      appState.transactions.forEach((tx, idx) => {
        grid.push([
          idx + 1,
          tx.date || "",
          tx.shop || "",
          tx.type || "",
          tx.person || "",
          tx.coinType || "",
          tx.coinCount || 0,
          tx.goldWeight || 0,
          tx.goldCredit || 0,
          tx.goldDebit || 0,
          tx.irrCredit || 0,
          tx.irrDebit || 0,
          tx.profit || 0,
          tx.note || ""
        ]);
      });

      const blob = buildXlsx({
        name: "دفتر حسابداری",
        rows: grid.length,
        cols: headers.length,
        // عرض ستون‌ها بر حسب پیکسل تا متن‌های فارسی جا شوند
        colWidths: headers.map((_, i) => (i === headers.length - 1 ? 220 : 120)),
        cell: (r, c) => {
          if (r === 0) return { v: headers[c] ?? "", bold: true, bg: "#fef9c3" };
          const v = grid[r]?.[c];
          if (v === undefined || v === "") return null;
          return { v };
        }
      });

      downloadBlob(blob, `دفتر_حسابداری_طلا_${Date.now()}.xlsx`);

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
            result.addedCoins > 0 ||
            result.addedSheets > 0 ||
            result.updatedSheets > 0 ||
            result.removedSheets > 0;

          if (hasChanges) {
            setSuccessMsg("ادغام بک‌آپ با موفقیت انجام شد. جزئیات تغییرات را در زیر ببینید.");
          } else {
            setSuccessMsg("بک‌آپ بررسی شد — هیچ تغییر جدیدی یافت نشد. اطلاعات شما به‌روز است.");
          }
        } else {
          // جایگزینی کامل (حالت قدیمی)
          // اگر فایل بک‌آپ قدیمی باشد و فیلد sheets نداشته باشد، برگه‌های
          // صفحه‌گسترده‌ی فعلی حفظ می‌شوند تا سهواً پاک نشوند.
          const replacement: AppState = Array.isArray(importedState.sheets)
            ? importedState
            : { ...importedState, sheets: appState.sheets ?? [] };
          await onRestoreState(replacement);
          const sheetCount = replacement.sheets?.length ?? 0;
          setSuccessMsg(
            sheetCount > 0
              ? `کل دفاتر مالی، تنظیمات، همکاران، مغازه‌ها و ${toPersianDigits(sheetCount)} برگه صفحه‌گسترده با موفقیت بازیابی شدند.`
              : "کل دفاتر مالی، تنظیمات، همکاران و مغازه‌ها با موفقیت بازیابی شدند."
          );
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
      <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <BrandIcon name="backup" size={22} />
          مرکز پشتیبان‌گیری و بازیابی دفاتر حسابداری طلا
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          داده‌های حسابداری طلا به صورت محلی در حافظه مرورگر امن شما و سرور محلی ذخیره می‌شوند. جهت جلوگیری از بروز حوادث غیرمترقبه یا پاک شدن کش‌ها، می‌توانید در چند ثانیه بک‌آپ کامل بگیرید و یا در صورت نیاز کل فاکتورها و دفاتر معین مغازه‌ها را بازگردانی کنید.
        </p>
      </div>

      {/* Trigger messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md p-4 flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-md p-4 flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <Warning className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export backups panel */}
        <div className="bg-white border border-slate-200 rounded-md p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <DownloadSimple className="w-[18px] h-[18px] text-blue-500" />
            تهیه نسخه پشتیبان (خروجی گرفتن)
          </h3>

          <div className="space-y-3 text-xs font-medium">
            {/* CSV Excel Backup */}
            <button
              onClick={exportToExcelCSV}
              className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-all cursor-pointer text-right min-h-[50px] active:scale-[0.98]"
            >
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block text-xs">دانلود بک‌آپ اکسل (فرمت xlsx)</span>
                <span className="text-[10px] text-slate-400 font-medium">راست‌به‌چپ، آماده باز شدن در مایکروسافت اکسل</span>
              </div>
              <FileXls className="w-5 h-5 text-blue-600 shrink-0" />
            </button>

            {/* JSON Full Backup */}
            <button
              onClick={exportToJSON}
              className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-all cursor-pointer text-right min-h-[50px] active:scale-[0.98]"
            >
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block text-xs">دانلود بک‌آپ کامل نرم‌افزار (.json)</span>
                <span className="text-[10px] text-slate-400 font-medium">شامل تنظیمات اولیه غرفه‌ها، اشخاص، کل اسناد و برگه‌های صفحه‌گسترده (اکسل داخلی)</span>
              </div>
              <DownloadSimple className="w-5 h-5 text-slate-600 shrink-0" />
            </button>
          </div>
        </div>

        {/* Restore backup panel */}
        <div className="bg-white border border-slate-200 rounded-md p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <UploadSimple className="w-[18px] h-[18px] text-blue-500" />
            بازیابی اطلاعات (وارد کردن بک‌آپ)
          </h3>

          <div className="space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              فایلی با پسوند <code className="text-blue-600 font-mono">.json</code> که قبلاً از این قسمت دانلود کرده‌اید را وارد کنید:
            </p>

            {/* انتخاب حالت import */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImportMode("merge")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-md border-2 transition-all text-center cursor-pointer ${
                  importMode === "merge"
                    ? "border-blue-600 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                }`}
              >
                <GitMerge className={`w-4 h-4 ${importMode === "merge" ? "text-blue-600" : "text-slate-400"}`} />
                <span className="text-[10px] font-bold">ادغام هوشمند</span>
                <span className="text-[9px] font-medium leading-tight">فقط تغییرات اعمال می‌شه</span>
              </button>
              <button
                onClick={() => setImportMode("replace")}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-md border-2 transition-all text-center cursor-pointer ${
                  importMode === "replace"
                    ? "border-rose-400 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                }`}
              >
                <ArrowsClockwise className={`w-4 h-4 ${importMode === "replace" ? "text-rose-500" : "text-slate-400"}`} />
                <span className="text-[10px] font-bold">جایگزینی کامل</span>
                <span className="text-[9px] font-medium leading-tight">همه داده‌ها بازنویسی می‌شن</span>
              </button>
            </div>

            {/* توضیح حالت انتخاب‌شده */}
            {importMode === "merge" ? (
              <div className="bg-blue-50 p-3 border border-blue-100 rounded text-[10px] text-blue-700 leading-relaxed font-medium">
                <span className="font-bold block mb-1">حالت ادغام هوشمند:</span>
                تراکنش‌های جدید اضافه، ویرایش‌شده‌ها آپدیت، و حذف‌شده‌ها پاک می‌شن. موارد تکراری نادیده گرفته می‌شن. مغازه‌ها و اشخاص جدید هم اضافه می‌شن. برگه‌های صفحه‌گسترده (اکسل داخلی) هم به همین شکل ادغام می‌شن.
              </div>
            ) : (
              <div className="bg-rose-50 p-3 border border-rose-100 rounded flex gap-2">
                <Warning className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-rose-700 leading-relaxed font-medium">
                  <span className="font-bold block mb-1">هشدار: جایگزینی کامل</span>
                  تمام اسناد موجود پاک و با فایل بک‌آپ جایگزین می‌شن. این عمل برگشت‌پذیر نیست.
                </div>
              </div>
            )}

            <div className="relative">
              <label className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-dashed border-slate-300 rounded-md hover:border-blue-600 hover:bg-blue-500/5 transition-all cursor-pointer">
                {loading ? (
                  <ArrowsClockwise className="w-8 h-8 text-blue-600 animate-spin" />
                ) : (
                  <UploadSimple className="w-8 h-8 text-slate-400 mb-2" />
                )}
                <span className="text-xs font-bold text-slate-800">انتخاب فایل پشتیبان (.json)</span>
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
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm space-y-3 animate-fadeIn">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-blue-500" />
            جزئیات تغییرات اعمال‌شده
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-md p-3 text-center">
              <div className="text-xl font-bold text-emerald-700">{toPersianDigits(mergeResult.addedTransactions)}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">سند جدید اضافه‌شده</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{toPersianDigits(mergeResult.updatedTransactions)}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">سند ویرایش‌شده</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-md p-3 text-center">
              <div className="text-xl font-bold text-rose-700">{toPersianDigits(mergeResult.removedTransactions)}</div>
              <div className="text-[10px] text-rose-600 font-semibold mt-0.5">سند حذف‌شده</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-md p-3 text-center">
              <div className="text-xl font-bold text-slate-500">{toPersianDigits(mergeResult.skippedTransactions)}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">تکراری (نادیده‌گرفته‌شده)</div>
            </div>
            {(mergeResult.addedShops > 0 || mergeResult.addedPersons > 0 || mergeResult.addedCoins > 0) && (
              <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-center col-span-2 sm:col-span-2">
                <div className="text-xl font-bold text-blue-700">
                  {toPersianDigits(mergeResult.addedShops + mergeResult.addedPersons + mergeResult.addedCoins)}
                </div>
                <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                  مغازه/شخص/سکه جدید اضافه‌شده
                </div>
              </div>
            )}
            {(mergeResult.addedSheets > 0 || mergeResult.updatedSheets > 0 || mergeResult.removedSheets > 0) && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-md p-3 text-center col-span-2 sm:col-span-2">
                <div className="text-xl font-bold text-indigo-700">
                  {toPersianDigits(mergeResult.addedSheets + mergeResult.updatedSheets + mergeResult.removedSheets)}
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                  برگه صفحه‌گسترده ({toPersianDigits(mergeResult.addedSheets)} جدید،{" "}
                  {toPersianDigits(mergeResult.updatedSheets)} به‌روز،{" "}
                  {toPersianDigits(mergeResult.removedSheets)} حذف)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
