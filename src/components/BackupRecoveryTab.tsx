import React, { useState } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { AppState, Transaction } from "../types";
import { formatCurrency, formatWeight, toPersianDigits } from "../utils";

interface BackupRecoveryTabProps {
  appState: AppState;
  onRestoreState: (state: AppState) => Promise<void>;
}

export default function BackupRecoveryTab({ appState, onRestoreState }: BackupRecoveryTabProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  // 3. Import JSON or parse uploaded Excel Backup file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        
        // Try parsing as JSON first
        let importedState: AppState;
        try {
          importedState = JSON.parse(text);
          
          // Basic field validations to ensure database integrity
          if (!importedState.settings || !Array.isArray(importedState.transactions)) {
            throw new Error("ساختار فایل نامعتبر است.");
          }
        } catch (jsonErr) {
          // If JSON parse fails, check if we can reconstruct minimal state from standard CSV headers
          setErrorMsg("فرمت فایل باید یک فایل معتبر با پسوند .json پشتیبان سیستم باشد.");
          setLoading(false);
          return;
        }

        // Send restored payload to full state callback
        await onRestoreState(importedState);
        setSuccessMsg("کل دفاتر مالی، تنظیمات، همکاران و مغازه‌ها با موفقیت بازیابی شدند.");
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: any) {
        setErrorMsg(err.message || "خطا در خواندن فایل یا ناهمگونی ساختار داده.");
      } finally {
        setLoading(false);
        // Reset file element value so the same file could be loaded again
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
              جهت بارگذاری مجدد تراکنش‌ها و تنظیمات مغازه‌ها، فایلی با پسوند <code className="text-amber-600 font-mono">.json</code> که قبلاً از این قسمت دانلود کرده‌اید را در کادر زیر قرار دهید:
            </p>

            <div className="relative">
              <label className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl hover:border-amber-500 hover:bg-amber-500/5 transition-all cursor-pointer">
                {loading ? (
                  <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                )}
                <span className="text-xs font-extrabold text-slate-800">انتخاب فایل پشتیبان کل سیستم (.json)</span>
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

            <div className="bg-amber-55/10 bg-amber-50/40 p-4 border border-amber-100 rounded-xl flex gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-800 leading-relaxed font-semibold">
                توجه: بارگذاری فایل بک‌آپ، تمام اسناد موجود فعلی روی این سیستم را بازنویسی و جایگزین می‌کند. پیش از بارگذاری مطمئن شوید فایل صحیحی را انتخاب کرده‌اید.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
