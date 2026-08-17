import React from "react";
import { Coins, TrendUp, Bank, Pulse } from "@phosphor-icons/react";
import { AppSettings, Transaction } from "../types";
import { formatCurrency, formatWeight, toPersianDigits } from "../utils";
import { EmptyRow } from "./EmptyState";
import BrandIcon from "./BrandIcon";

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
        <div className="bg-white border border-slate-200 border-r-[3px] border-r-amber-500 rounded p-4 md:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-medium text-slate-500">موجودی کل طلا</span>
            <div className="p-1.5 md:p-2 bg-amber-50 text-amber-600 rounded">
              <Coins className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-base md:text-xl font-bold font-sans text-slate-900 tracking-tight">
            {formatWeight(currentTotalGold)}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 lines-clamp-1">
            اولیه: {formatWeight(totalInitialGold)} | تغییرات: {formatWeight(totalGoldCredits - totalGoldDebits)}
          </p>
        </div>

        {/* Stat 2: IRR */}
        <div className="bg-white border border-slate-200 border-r-[3px] border-r-blue-600 rounded p-4 md:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-medium text-slate-500">موجودی کل ریال</span>
            <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded">
              <Bank className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-base md:text-xl font-bold font-sans text-slate-900 tracking-tight">
            {formatCurrency(currentTotalIRR)}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 lines-clamp-1">
            اولیه: {formatCurrency(totalInitialIRR)} | تغییرات: {formatCurrency(totalIRRCredits - totalIRRDebits)}
          </p>
        </div>

        {/* Stat 3: Profits */}
        <div className={`bg-white border border-slate-200 border-r-[3px] rounded p-4 md:p-5 relative overflow-hidden ${totalProfit >= 0 ? "border-r-emerald-500" : "border-r-rose-500"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-medium text-slate-500">کل سود و زیان (ریال)</span>
            <div className={`p-1.5 md:p-2 rounded ${totalProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              <TrendUp className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className={`text-base md:text-xl font-bold font-sans ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"} tracking-tight`}>
            {formatCurrency(totalProfit)}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">حاصل از خرید/فروش‌های روز</p>
        </div>

        {/* Stat 4: Transaction count */}
        <div className="bg-white border border-slate-200 border-r-[3px] border-r-violet-500 rounded p-4 md:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] md:text-xs font-medium text-slate-500">تعداد کل تراکنش‌ها</span>
            <div className="p-1.5 md:p-2 bg-violet-50 text-violet-600 rounded">
              <Pulse className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-base md:text-xl font-bold font-sans text-slate-900 tracking-tight">
            {toPersianDigits(transactions.length)} سند مالی
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">ذخیره شده در حافظه مرورگر و سرور</p>
        </div>
      </div>

      <div className="w-full">
        {/* Shop management table summary */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 px-5 md:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <BrandIcon name="dashboard" size={22} />
            خلاصه وضعیت موجودی به تفکیک مغازه‌ها
          </h3>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs min-w-[500px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-3 px-4">نام مغازه</th>
                  <th className="py-3 px-4">موجودی اولیه (طلا | ریال)</th>
                  <th className="py-3 px-4">تغییرات (طلا | ریال)</th>
                  <th className="py-3 px-4">موجودی فعلی طلا</th>
                  <th className="py-3 px-4">موجودی فعلی ریال</th>
                  <th className="py-3 px-4 text-left">سند / سود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.shops.length === 0 ? (
                  <EmptyRow
                    colSpan={6}
                    image="/brand/empty-sheets.webp"
                    title="هیچ مغازه‌ای ثبت نشده است."
                    hint="از زبانه‌ی «تنظیمات» اولین مغازه را اضافه کنید تا داشبورد پر شود."
                  />
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
                      <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{shop.name}</td>
                        <td className="py-3.5 px-4 text-[10px]">
                          <div className="text-slate-600 font-mono">{formatWeight(shop.initialGold)}</div>
                          <div className="text-slate-400 font-mono">{formatCurrency(shop.initialIRR)}</div>
                        </td>
                        <td className="py-3.5 px-4 text-[10px]">
                          <div className={`font-mono font-semibold ${(sGoldCredit - sGoldDebit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {(sGoldCredit - sGoldDebit) >= 0 ? "+" : ""}{formatWeight(sGoldCredit - sGoldDebit)}
                          </div>
                          <div className={`font-mono font-semibold ${(sIRRCredit - sIRRDebit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {(sIRRCredit - sIRRDebit) >= 0 ? "+" : ""}{formatCurrency(sIRRCredit - sIRRDebit)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-amber-600 font-mono">{formatWeight(curGold)}</td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-600 font-mono">{formatCurrency(curIRR)}</td>
                        <td className="py-3.5 px-4 text-left text-[10px]">
                          <span className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mb-1 font-mono">
                            {toPersianDigits(sCount)} سند
                          </span>
                          <div className={`font-semibold font-mono ${sProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
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
