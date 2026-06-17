import React from "react";
import { Coins, TrendingUp, ShoppingBag, Landmark, Activity } from "lucide-react";
import { AppSettings, Transaction } from "../types";
import { formatCurrency, formatWeight, toPersianDigits } from "../utils";

interface DashboardTabProps {
  settings: AppSettings;
  transactions: Transaction[];
}

export default function DashboardTab({ settings, transactions }: DashboardTabProps) {
  // Calculates aggregated totals
  const totalInitialGold = settings.shops.reduce((sum, s) => sum + s.initialGold, 0);
  const totalInitialIRR = settings.shops.reduce((sum, s) => sum + s.initialIRR, 0);

  const totalGoldCredits = transactions.reduce((sum, tx) => sum + (tx.goldCredit || 0), 0);
  const totalGoldDebits = transactions.reduce((sum, tx) => sum + (tx.goldDebit || 0), 0);

  const totalIRRCredits = transactions.reduce((sum, tx) => sum + (tx.irrCredit || 0), 0);
  const totalIRRDebits = transactions.reduce((sum, tx) => sum + (tx.irrDebit || 0), 0);

  const currentTotalGold = totalInitialGold + totalGoldCredits - totalGoldDebits;
  const currentTotalIRR = totalInitialIRR + totalIRRCredits - totalIRRDebits;
  const totalProfit = transactions.reduce((sum, tx) => sum + (tx.profit || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top statistics cards container - 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Stat 1: Gold */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-semibold text-slate-500">موجودی کل طلا</span>
            <div className="p-1.5 md:p-2 bg-amber-600/10 text-amber-600 rounded-xl">
              <Coins className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-base md:text-xl font-extrabold font-sans text-amber-600 tracking-tight">
            {formatWeight(currentTotalGold)}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 lines-clamp-1">
            اولیه: {formatWeight(totalInitialGold)} | تغییرات: {formatWeight(totalGoldCredits - totalGoldDebits)}
          </p>
        </div>

        {/* Stat 2: IRR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-semibold text-slate-500">موجودی کل ریال</span>
            <div className="p-1.5 md:p-2 bg-emerald-600/10 text-emerald-600 rounded-xl">
              <Landmark className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-base md:text-xl font-extrabold font-sans text-emerald-600 tracking-tight">
            {formatCurrency(currentTotalIRR)}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 lines-clamp-1">
            اولیه: {formatCurrency(totalInitialIRR)} | تغییرات: {formatCurrency(totalIRRCredits - totalIRRDebits)}
          </p>
        </div>

        {/* Stat 3: Profits */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-semibold text-slate-500">کل سود و زیان (ریال)</span>
            <div className={`p-1.5 md:p-2 rounded-xl ${totalProfit >= 0 ? "bg-emerald-600/10 text-emerald-600" : "bg-rose-600/10 text-rose-600"}`}>
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`text-base md:text-xl font-extrabold font-sans ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"} tracking-tight`}>
            {formatCurrency(totalProfit)}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">حاصل از خرید/فروش‌های روز</p>
        </div>

        {/* Stat 4: Transaction count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-semibold text-slate-500">تعداد کل تراکنش‌ها</span>
            <div className="p-1.5 md:p-2 bg-blue-600/10 text-blue-600 rounded-xl">
              <Activity className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-base md:text-xl font-extrabold font-sans text-blue-600 tracking-tight">
            {toPersianDigits(transactions.length)} سند مالی
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">ذخیره شده در حافظه مرورگر و سرور</p>
        </div>
      </div>

      <div className="w-full">
        {/* Shop management table summary */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm overflow-hidden">
          <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            خلاصه وضعیت موجودی به تفکیک مغازه‌ها
          </h3>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-3 px-2">نام مغازه</th>
                  <th className="py-3 px-2">موجودی اولیه (طلا | ریال)</th>
                  <th className="py-3 px-2">تغییرات (طلا | ریال)</th>
                  <th className="py-3 px-2">موجودی فعلی طلا</th>
                  <th className="py-3 px-2">موجودی فعلی ریال</th>
                  <th className="py-3 px-2 text-left">سند / سود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {settings.shops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      هیچ مغازه‌ای ثبت نشده است. ابتدا از زبانه "ثبت تراکنش‌ها" یا "تنظیمات" اقدام نمایید.
                    </td>
                  </tr>
                ) : (
                  settings.shops.map((shop) => {
                    const sGoldCredit = transactions.filter(t => t.shop === shop.name).reduce((sum, tx) => sum + (tx.goldCredit || 0), 0);
                    const sGoldDebit = transactions.filter(t => t.shop === shop.name).reduce((sum, tx) => sum + (tx.goldDebit || 0), 0);
                    const sIRRCredit = transactions.filter(t => t.shop === shop.name).reduce((sum, tx) => sum + (tx.irrCredit || 0), 0);
                    const sIRRDebit = transactions.filter(t => t.shop === shop.name).reduce((sum, tx) => sum + (tx.irrDebit || 0), 0);
                    const sProfit = transactions.filter(t => t.shop === shop.name).reduce((sum, tx) => sum + (tx.profit || 0), 0);
                    const sCount = transactions.filter(t => t.shop === shop.name).length;

                    const curGold = shop.initialGold + sGoldCredit - sGoldDebit;
                    const curIRR = shop.initialIRR + sIRRCredit - sIRRDebit;

                    return (
                      <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-2 font-bold text-slate-800">{shop.name}</td>
                        <td className="py-3.5 px-2 text-[10px]">
                          <div className="text-slate-600 font-mono">{formatWeight(shop.initialGold)}</div>
                          <div className="text-slate-400 font-mono">{formatCurrency(shop.initialIRR)}</div>
                        </td>
                        <td className="py-3.5 px-2 text-[10px]">
                          <div className={`font-mono font-bold ${(sGoldCredit - sGoldDebit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {(sGoldCredit - sGoldDebit) >= 0 ? "+" : ""}{formatWeight(sGoldCredit - sGoldDebit)}
                          </div>
                          <div className={`font-mono font-bold ${(sIRRCredit - sIRRDebit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {(sIRRCredit - sIRRDebit) >= 0 ? "+" : ""}{formatCurrency(sIRRCredit - sIRRDebit)}
                          </div>
                        </td>
                        <td className="py-3.5 px-2 font-bold text-amber-600 font-mono">{formatWeight(curGold)}</td>
                        <td className="py-3.5 px-2 font-bold text-emerald-600 font-mono">{formatCurrency(curIRR)}</td>
                        <td className="py-3.5 px-2 text-left text-[10px]">
                          <span className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md mb-1 font-mono">
                            {toPersianDigits(sCount)} سند
                          </span>
                          <div className={`font-bold font-mono ${sProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatCurrency(sProfit)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
