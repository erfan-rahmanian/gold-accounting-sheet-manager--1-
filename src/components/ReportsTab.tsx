import React, { useState } from "react";
import { Users, ShoppingBag, FileText, X, Printer, Search, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { AppSettings, Transaction } from "../types";
import { formatCurrency, formatWeight, toPersianDigits } from "../utils";

interface ReportsTabProps {
  settings: AppSettings;
  transactions: Transaction[];
}

export default function ReportsTab({ settings, transactions }: ReportsTabProps) {
  const [activeReport, setActiveReport] = useState<"shops" | "persons" | "dailyTrades">("shops");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpansion = (dateStr: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  // Group buy & sell transactions by day
  const dailyTradesData = (() => {
    const tradeTxs = transactions.filter(t => 
      t.type === "خرید طلا" || 
      t.type === "فروش طلا" || 
      t.type === "خرید و فروش" || 
      t.type === "خرید و فروش (امروزی)" || 
      t.type === "خرید و فروش (فردایی)"
    );

    // Get unique dates
    const uniqueDates = Array.from(new Set(tradeTxs.map(t => t.date)));
    
    // Sort dates descending (newest first)
    uniqueDates.sort((a, b) => b.localeCompare(a));

    return uniqueDates.map((date, idx) => {
      const datesTxs = tradeTxs.filter(t => t.date === date);
      
      const goldBought = datesTxs.reduce((sum, t) => {
        if (t.type === "خرید طلا" || t.type.includes("خرید و فروش")) {
          return sum + (t.goldWeight || 0);
        }
        return sum;
      }, 0);

      const goldSold = datesTxs.reduce((sum, t) => {
        if (t.type === "فروش طلا" || t.type.includes("خرید و فروش")) {
          return sum + (t.goldWeight || 0);
        }
        return sum;
      }, 0);

      const irrSpent = datesTxs.reduce((sum, t) => {
        if (t.type === "خرید طلا" || t.type.includes("خرید و فروش")) {
          return sum + (t.amount || 0);
        }
        return sum;
      }, 0);

      const irrEarned = datesTxs.reduce((sum, t) => {
        if (t.type === "فروش طلا") {
          return sum + (t.amount || 0);
        } else if (t.type.includes("خرید و فروش")) {
          return sum + (t.salesAmount || 0);
        }
        return sum;
      }, 0);

      const profit = datesTxs.reduce((sum, t) => sum + (t.profit || 0), 0);

      return {
        index: idx + 1,
        date,
        transactionsCount: datesTxs.length,
        goldBought,
        goldSold,
        irrSpent,
        irrEarned,
        profit,
        transactions: datesTxs
      };
    });
  })();

  // Calculations for Persons report
  const personsReportData = settings.persons.map((person, idx) => {
    const txs = transactions.filter(t => t.person === person);
    const goldCredit = txs.reduce((sum, t) => sum + (t.goldCredit || 0), 0);
    const goldDebit = txs.reduce((sum, t) => sum + (t.goldDebit || 0), 0);
    const irrCredit = txs.reduce((sum, t) => sum + (t.irrCredit || 0), 0);
    const irrDebit = txs.reduce((sum, t) => sum + (t.irrDebit || 0), 0);
    const profit = txs.reduce((sum, t) => sum + (t.profit || 0), 0);
    const txCount = txs.length;

    // Unique connected shops list
    const connectedShops = Array.from(new Set(txs.map(t => t.shop).filter(Boolean)));
    const connectedShopsLabel = connectedShops.length > 0 ? connectedShops.join("، ") : "-";

    const goldBalance = goldCredit - goldDebit;
    const irrBalance = irrCredit - irrDebit;

    return {
      index: idx + 1,
      name: person,
      goldBalance,
      irrBalance,
      profit,
      txCount,
      connectedShopsLabel
    };
  });

  // Calculations for Shops report
  const shopsReportData = settings.shops.map((shop, idx) => {
    const txs = transactions.filter(t => t.shop === shop.name);
    const goldCredit = txs.reduce((sum, t) => sum + (t.goldCredit || 0), 0);
    const goldDebit = txs.reduce((sum, t) => sum + (t.goldDebit || 0), 0);
    const irrCredit = txs.reduce((sum, t) => sum + (t.irrCredit || 0), 0);
    const irrDebit = txs.reduce((sum, t) => sum + (t.irrDebit || 0), 0);
    const profit = txs.reduce((sum, t) => sum + (t.profit || 0), 0);
    const txCount = txs.length;

    // Unique connected persons
    const connectedPersons = Array.from(new Set(txs.map(t => t.person).filter(Boolean)));
    const connectedPersonsLabel = connectedPersons.length > 0 ? connectedPersons.join("، ") : "-";

    const goldChange = goldCredit - goldDebit;
    const irrChange = irrCredit - irrDebit;

    const currentGold = shop.initialGold + goldChange;
    const currentIRR = shop.initialIRR + irrChange;

    return {
      index: idx + 1,
      name: shop.name,
      initialGold: shop.initialGold,
      initialIRR: shop.initialIRR,
      goldChange,
      irrChange,
      currentGold,
      currentIRR,
      profit,
      txCount,
      connectedPersonsLabel
    };
  });

  // Swapped Ledger Statement Generator (طرف حساب / معین)
  // Reverses perspective as requested by user compared to input view:
  // بدهکار طلا در برنامه برای طرف حساب = بستانکار طلا در بانک دی‌بی (goldCredit)
  // بستانکار طلا در برنامه برای طرف حساب = بدهکار طلا در بانک دی‌بی (goldDebit)
  const getPersonLedger = (personName: string) => {
    // Get all transactions sorted chronologically (oldest first to compute correct cumulative balance)
    const txsChronological = [...transactions].filter(t => t.person === personName).reverse();
    
    let runningGold = 0;
    let runningIRR = 0;

    return txsChronological.map((tx, idx) => {
      // Swapping credit/debit for client ledger:
      // بدهکار طرف‌حساب = بستانکاری ما (goldCredit)
      // بستانکار طرف‌حساب = بدهکاری ما (goldDebit)
      const bidGold = tx.goldCredit || 0;
      const besGold = tx.goldDebit || 0;
      const bidIRR = tx.irrCredit || 0;
      const besIRR = tx.irrDebit || 0;

      runningGold = runningGold + bidGold - besGold;
      runningIRR = runningIRR + bidIRR - besIRR;

      return {
        id: tx.id,
        type: tx.type,
        serial: tx.id.replace("tx-", ""),
        numIndex: idx + 1,
        date: tx.date,
        note: tx.note || "ثبت معامله در سیستم",
        bidGold,
        besGold,
        goldBalance: runningGold,
        bidIRR,
        besIRR,
        irrBalance: runningIRR
      };
    }).reverse(); // Display newest first in the resulting table view
  };

  const getShopLedger = (shopName: string) => {
    const shop = settings.shops.find(s => s.name === shopName);
    const initialGold = shop ? shop.initialGold : 0;
    const initialIRR = shop ? shop.initialIRR : 0;

    const txsChronological = [...transactions].filter(t => t.shop === shopName).reverse();

    let runningGold = initialGold;
    let runningIRR = initialIRR;

    const firstEntry = {
      id: "initial",
      type: "سند افتتاحیه",
      serial: "---",
      numIndex: 0,
      date: "اول دوره",
      note: "موجودی اولیه مغازه",
      bidGold: 0,
      besGold: 0,
      goldBalance: initialGold,
      bidIRR: 0,
      besIRR: 0,
      irrBalance: initialIRR
    };

    const entries = txsChronological.map((tx, idx) => {
      const bidGold = tx.goldCredit || 0;
      const besGold = tx.goldDebit || 0;
      const bidIRR = tx.irrCredit || 0;
      const besIRR = tx.irrDebit || 0;

      runningGold = runningGold + bidGold - besGold;
      runningIRR = runningIRR + bidIRR - besIRR;

      return {
        id: tx.id,
        type: tx.type,
        serial: tx.id.replace("tx-", ""),
        numIndex: idx + 1,
        date: tx.date,
        note: tx.note || "ثبت سنجه مالی",
        bidGold,
        besGold,
        goldBalance: runningGold,
        bidIRR,
        besIRR,
        irrBalance: runningIRR
      };
    });

    return [firstEntry, ...entries].reverse();
  };

  const activeLedgerData = selectedPerson 
    ? getPersonLedger(selectedPerson) 
    : selectedShop 
      ? getShopLedger(selectedShop) 
      : [];

  const filteredLedger = activeLedgerData.filter(row => {
    return row.note.toLowerCase().includes(ledgerSearch.toLowerCase()) || 
           row.type.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
           row.date.toLowerCase().includes(ledgerSearch.toLowerCase());
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Stylesheet injection to support clean paper print layouts directly from browser */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-ledger-section, #printable-ledger-section * {
            visibility: visible;
          }
          #printable-ledger-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Tab select headers - Large touch-friendly switches */}
      <div className="flex bg-slate-100 border border-slate-200 rounded-2xl p-1 max-w-md mx-auto shadow-sm no-print">
        <button
          onClick={() => {
            setActiveReport("shops");
            setSelectedPerson(null);
            setSelectedShop(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer min-h-[40px] ${
            activeReport === "shops"
              ? "bg-white text-amber-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
          مغازه‌ها ‌(کارکرد)
        </button>
        <button
          onClick={() => {
            setActiveReport("persons");
            setSelectedPerson(null);
            setSelectedShop(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer min-h-[40px] ${
            activeReport === "persons"
              ? "bg-white text-amber-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-amber-600" />
          اشخاص (تراز)
        </button>
        <button
          onClick={() => {
            setActiveReport("dailyTrades");
            setSelectedPerson(null);
            setSelectedShop(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer min-h-[40px] ${
            activeReport === "dailyTrades"
              ? "bg-white text-amber-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
          معاملات روزانه
        </button>
      </div>

      {activeReport === "shops" && (
        /* Shops Report Table - Premium Light mode */
        <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden animate-fadeIn no-print">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              تراز تجمعی و کارنامک مغازه‌ها
            </h3>
            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-lg">برای مشاهده صورت‌حساب کلیک کنید</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs min-w-[750px]">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                  <th className="py-3 px-1 font-mono w-10">ردیف</th>
                  <th className="py-3 px-2">نام مغازه</th>
                  <th className="py-3 px-2">موجودی اولیه طلا</th>
                  <th className="py-3 px-2">موجودی اولیه ریال</th>
                  <th className="py-3 px-2">تغییرات طلا</th>
                  <th className="py-3 px-2">تغییرات ریال</th>
                  <th className="py-3 px-2 text-amber-600">موجودی فعلی طلا</th>
                  <th className="py-3 px-2 text-emerald-600">موجودی فعلی ریال</th>
                  <th className="py-3 px-2">سود / زیان کل</th>
                  <th className="py-3 px-2 w-48">همکاران مرتبط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {shopsReportData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 font-bold">
                      مغازه‌ای تعریف نشده است.
                    </td>
                  </tr>
                ) : (
                  shopsReportData.map((shop) => (
                    <tr 
                      key={shop.name} 
                      onClick={() => {
                        setSelectedShop(shop.name);
                        setSelectedPerson(null);
                      }}
                      className={`hover:bg-amber-500/5 cursor-pointer transition-all ${selectedShop === shop.name ? "bg-amber-500/10 border-l-4 border-amber-500 font-bold" : ""}`}
                    >
                      <td className="py-3.5 px-1 text-slate-400 font-mono font-medium">{toPersianDigits(shop.index)}</td>
                      <td className="py-3.5 px-2 font-black text-slate-900 text-xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {shop.name}
                      </td>
                      <td className="py-3.5 px-2 font-mono text-slate-600">{formatWeight(shop.initialGold)}</td>
                      <td className="py-3.5 px-2 font-mono text-slate-600">{formatCurrency(shop.initialIRR)}</td>
                      <td className={`py-3.5 px-2 font-mono font-bold ${shop.goldChange >= 0 ? "text-emerald-750" : "text-rose-700"}`}>
                        {shop.goldChange >= 0 ? "+" : ""}{formatWeight(shop.goldChange)}
                      </td>
                      <td className={`py-3.5 px-2 font-mono font-bold ${shop.irrChange >= 0 ? "text-emerald-750" : "text-rose-700"}`}>
                        {shop.irrChange >= 0 ? "+" : ""}{formatCurrency(shop.irrChange)}
                      </td>
                      <td className="py-3.5 px-2 font-extrabold font-mono text-amber-600">{formatWeight(shop.currentGold)}</td>
                      <td className="py-3.5 px-2 font-extrabold font-mono text-emerald-600">{formatCurrency(shop.currentIRR)}</td>
                      <td className="py-3.5 px-2">
                        <div className={`font-black font-mono ${shop.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatCurrency(shop.profit)}
                        </div>
                        <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{toPersianDigits(shop.txCount)} تراکنش</span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-400 font-semibold max-w-[150px] truncate" title={shop.connectedPersonsLabel}>
                        {shop.connectedPersonsLabel}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === "persons" && (
        /* Persons Report Table */
        <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden animate-fadeIn no-print">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              تراز دفاتر معین و بستانکاری اشخاص
            </h3>
            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-lg">برای مشاهده صورت‌حساب کلیک کنید</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs min-w-[600px]">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                  <th className="py-3 px-1 font-mono w-10">ردیف</th>
                  <th className="py-3 px-2">نام شخص ذینفع / همکار</th>
                  <th className="py-3 px-2 text-amber-650 text-slate-900">مانده طلا (گرم)</th>
                  <th className="py-3 px-2 text-emerald-650 text-slate-900">مانده ریال (ریال)</th>
                  <th className="py-3 px-2">سود / زیان با تفکیک</th>
                  <th className="py-3 px-2">تعداد کل معاملات</th>
                  <th className="py-3 px-2">مغازه‌های مرتبط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {personsReportData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                      شخصی تعریف نشده است.
                    </td>
                  </tr>
                ) : (
                  personsReportData.map((person) => (
                    <tr 
                      key={person.name} 
                      onClick={() => {
                        setSelectedPerson(person.name);
                        setSelectedShop(null);
                      }}
                      className={`hover:bg-amber-500/5 cursor-pointer transition-all ${selectedPerson === person.name ? "bg-amber-500/10 border-l-4 border-amber-500 font-bold" : ""}`}
                    >
                      <td className="py-3.5 px-1 text-slate-400 font-mono font-medium">{toPersianDigits(person.index)}</td>
                      <td className="py-3.5 px-2 font-black text-slate-900 text-xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {person.name}
                      </td>
                      <td className={`py-3.5 px-2 font-extrabold font-mono ${person.goldBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatWeight(person.goldBalance)}
                      </td>
                      <td className={`py-3.5 px-2 font-extrabold font-mono ${person.irrBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatCurrency(person.irrBalance)}
                      </td>
                      <td className={`py-3.5 px-2 font-extrabold font-mono ${person.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatCurrency(person.profit)}
                      </td>
                      <td className="py-3.5 px-2 text-slate-500 font-semibold font-mono">{toPersianDigits(person.txCount)} فیش مالی</td>
                      <td className="py-3.5 px-2 text-slate-400 font-semibold max-w-[180px] truncate" title={person.connectedShopsLabel}>
                        {person.connectedShopsLabel}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === "dailyTrades" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden animate-fadeIn no-print space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                دفتر معاملات خرید و فروش طلا به تفکیک روز
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold font-sans">
                این تراز تخصصی، خلاصه کل حجم خرید و فروش‌های فیزیکی طلا و صنف آبشده را به همراه سود خالص برآوردی به صورت روزانه محاسبه می‌کند.
              </p>
            </div>
            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-lg self-start sm:self-center">بخش گزارش معاملات طلا</span>
          </div>

          <div className="overflow-x-auto w-full text-semibold">
            <table className="w-full text-right text-xs min-w-[850px]">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                  <th className="py-3 px-1 font-mono w-10 text-center">ردیف</th>
                  <th className="py-3 px-2">روز / تاریخ معامله</th>
                  <th className="py-3 px-2">تعداد معاملات</th>
                  <th className="py-3 px-2 text-emerald-700">کل خرید طلا (گرم)</th>
                  <th className="py-3 px-2 text-rose-700">کل فروش طلا (گرم)</th>
                  <th className="py-3 px-2">جمع بهای خرید (ریال)</th>
                  <th className="py-3 px-2">جمع ثمن فروش (ریال)</th>
                  <th className="py-3 px-2 text-emerald-600 font-black">سود / زیان کل روز</th>
                  <th className="py-3 px-2 text-center w-28">لیست فیش‌ها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {dailyTradesData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      هیچ تراکنش خرید و فروشی در سیستم حسابداری شما ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  dailyTradesData.map((day, idx) => {
                    const isExpanded = !!expandedDays[day.date];
                    return (
                      <React.Fragment key={day.date}>
                        <tr className={`hover:bg-amber-500/5 transition-all ${isExpanded ? "bg-slate-50/80" : ""}`}>
                          <td className="py-4 px-1 text-center text-slate-400 font-mono font-medium">{toPersianDigits(day.index)}</td>
                          <td className="py-4 px-2 font-black text-slate-900 text-xs">{day.date}</td>
                          <td className="py-4 px-2 font-bold font-mono text-slate-650">{toPersianDigits(day.transactionsCount)} معامله</td>
                          <td className="py-4 px-2 font-mono text-emerald-700 font-bold">{day.goldBought > 0 ? formatWeight(day.goldBought) : "۰"}</td>
                          <td className="py-4 px-2 font-mono text-rose-700 font-bold">{day.goldSold > 0 ? formatWeight(day.goldSold) : "۰"}</td>
                          <td className="py-4 px-2 font-mono text-slate-500">{day.irrSpent > 0 ? formatCurrency(day.irrSpent) : "۰ ریال"}</td>
                          <td className="py-4 px-2 font-mono text-slate-500">{day.irrEarned > 0 ? formatCurrency(day.irrEarned) : "۰ ریال"}</td>
                          <td className={`py-4 px-2 font-black font-mono text-[11.5px] ${day.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {day.profit !== 0 ? formatCurrency(day.profit) : "۰ ریال"}
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button
                              onClick={() => toggleDayExpansion(day.date)}
                              className="text-amber-700 hover:text-white border border-amber-200 hover:border-amber-500 bg-amber-50 hover:bg-amber-500 text-[10px] font-extrabold px-3 py-1.5 rounded-xl cursor-pointer transition-all inline-flex items-center gap-1"
                            >
                              <span>{isExpanded ? "بستن جزئیات" : "مشاهده فیش‌ها"}</span>
                              <span className="font-mono text-[9px]">({toPersianDigits(day.transactionsCount)})</span>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={9} className="p-4">
                              <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-inner space-y-3 animate-fadeIn">
                                <h4 className="text-[11px] font-extrabold text-amber-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                  <span>لیست تراکنش‌های معاملاتی روز {day.date}</span>
                                </h4>
                                <div className="overflow-x-auto w-full">
                                  <table className="w-full text-right text-[11px] min-w-[700px]">
                                    <thead>
                                      <tr className="text-slate-400 font-bold border-b border-slate-100 pb-1 text-center">
                                        <th className="py-2 px-1 text-right">مغازه</th>
                                        <th className="py-2 px-1 text-right">طرف حساب</th>
                                        <th className="py-2 px-1">نوع</th>
                                        <th className="py-2 px-1 text-center">وزن طلا گرم</th>
                                        <th className="py-2 px-1 text-center">بهای خرید سند</th>
                                        <th className="py-2 px-1 text-center">ثمن فروش سند</th>
                                        <th className="py-2 px-1 text-right font-black">سود / زیان</th>
                                        <th className="py-2 px-2 text-right">توضیحات</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150">
                                      {day.transactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50 text-center">
                                          <td className="py-2.5 px-1 font-bold text-slate-800 text-right">{t.shop}</td>
                                          <td className="py-2.5 px-1 font-bold text-slate-800 text-right">{t.person || "عامه بازار/متفرقه"}</td>
                                          <td className="py-2.5 px-1 text-right">
                                            <span className="inline-block bg-amber-500/10 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[10px] border border-amber-500/10">
                                              {t.type}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-1 font-mono text-slate-700 font-semibold">{t.goldWeight > 0 ? formatWeight(t.goldWeight) : "-"}</td>
                                          <td className="py-2.5 px-1 font-mono text-slate-600 font-semibold">{t.amount > 0 ? formatCurrency(t.amount) : "-"}</td>
                                          <td className="py-2.5 px-1 font-mono text-slate-600 font-semibold">{t.salesAmount > 0 ? formatCurrency(t.salesAmount) : "-"}</td>
                                          <td className={`py-2.5 px-1 font-mono font-black ${t.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                            {t.profit !== 0 ? formatCurrency(t.profit) : "0"}
                                          </td>
                                          <td className="py-2.5 px-2 text-slate-400 font-medium text-right max-w-[200px] truncate" title={t.note}>{t.note || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill-Down ACCOUNT LEDGER (صوت حساب تفصیلی معین طلا و ریال) - styled identically to PDF layout */}
      {(selectedPerson || selectedShop) && (
        <div id="printable-ledger-section" className="bg-white border-2 border-slate-300 rounded-3xl p-5 md:p-8 shadow-md space-y-6 animate-slideIn">
          
          {/* Statement Header Card matches commercial gold invoices exactly */}
          <div className="border-b-4 border-double border-slate-950 pb-5">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-right">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2 justify-center sm:justify-start">
                  <FileText className="w-5 h-5 text-amber-500 no-print" />
                  صورت‌حساب معین طلا و ریال: {selectedPerson || selectedShop}
                </h2>
                <p className="text-[10px] text-slate-500 mt-1.5 font-bold leading-relaxed no-print">
                  این گزارش بر پایه صورت‌حساب دفاتر بنکداری طلا (وارونه نسبت به فایل‌های صادره خام همکاران جهت نمایش تراز طرف‌حسابی شخص) تنظیم شده است.
                </p>
              </div>

              {/* Action buttons (Printer, Close) */}
              <div className="flex items-center gap-2 no-print shrink-0">
                <button
                  onClick={handlePrint}
                  className="bg-slate-900 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm min-h-[40px]"
                >
                  <Printer className="w-4 h-4" />
                  چاپ و دریافت PDF
                </button>
                <button
                  onClick={() => {
                    setSelectedPerson(null);
                    setSelectedShop(null);
                  }}
                  className="bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-extrabold text-[11px] px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer min-h-[40px]"
                >
                  <X className="w-4 h-4" />
                  بستن گزارش معین
                </button>
              </div>
            </div>

            {/* Quick stats grid for statement of account */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-medium">نوع گزارش:</span>
                <span className="font-bold text-slate-800 block mt-1">دفتر تراز تفصیلی معین</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">ذینفع گزارش:</span>
                <span className="font-bold text-slate-900 block mt-1 font-sans">{selectedPerson || selectedShop}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">تعداد تراکنش‌های معین:</span>
                <span className="font-extrabold text-amber-700 block mt-1 font-mono">{toPersianDigits(filteredLedger.length)} سند مالی</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">پایه عیار فرمول طلا:</span>
                <span className="font-bold text-emerald-700 block mt-1 font-mono">۷۵۰ (۱۸ عیار استاندارد)</span>
              </div>
            </div>
            
            {/* Quick in-ledger search */}
            <div className="mt-4 relative max-w-xs no-print">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input 
                type="text" 
                placeholder="جستجوی سریع درون صورت‌حساب..." 
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Core Table Layout matches commercial paper report identically */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-[10.5px] border-2 border-slate-300 min-w-[950px] border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 font-bold divide-x divide-slate-300 divide-x-reverse text-center">
                  <th className="py-3 px-1 w-10">ردیف</th>
                  <th className="py-3 px-2 w-20">نوع سند</th>
                  <th className="py-3 px-2 w-16">شماره سند</th>
                  <th className="py-3 px-2 w-20">تاریخ</th>
                  <th className="py-3 px-3 text-right">شرح کامل تراکنش</th>
                  <th className="py-3 px-2 text-rose-750 bg-rose-50/50 w-24">بد طلا (گرم)</th>
                  <th className="py-3 px-2 text-emerald-750 bg-emerald-50/50 w-24">بس طلا (گرم)</th>
                  <th className="py-3 px-2 w-28 bg-slate-100">مانده طلا (گرم)</th>
                  <th className="py-3 px-2 text-rose-750 bg-rose-50/50 w-28">بد ریالی</th>
                  <th className="py-3 px-2 text-emerald-750 bg-emerald-50/50 w-28">بس ریالی</th>
                  <th className="py-3 px-2 w-32 bg-slate-100">مانده ریالی</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300/80 divide-x divide-slate-200 divide-x-reverse font-medium text-slate-700">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-bold bg-slate-50/30">
                      هیچ سندی با معیارهای انتخابی شما در دفتر معین یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors text-center">
                      <td className="py-3 px-1 text-slate-400 font-mono font-medium">{toPersianDigits(idx + 1)}</td>
                      <td className="py-3 px-2">
                        <span className="inline-block bg-slate-100 border border-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded text-[9.5px]">
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-500 font-mono text-[9px] truncate max-w-[80px]" title={row.serial}>
                        {toPersianDigits(row.serial.substring(0, 4))}
                      </td>
                      <td className="py-3 px-2 text-slate-650 font-mono font-bold text-[9.5px]">{row.date}</td>
                      <td className="py-3 px-3 text-right text-slate-800 font-semibold text-[10px] break-words max-w-[200px]" title={row.note}>
                        {row.note}
                      </td>
                      
                      {/* Swapped Bed/Bes Gold columns */}
                      <td className="py-3 px-2 text-rose-750 font-mono font-bold bg-rose-50/15">
                        {row.bidGold > 0 ? formatWeight(row.bidGold).replace(" گرم", "") : "۰"}
                      </td>
                      <td className="py-3 px-2 text-emerald-750 font-mono font-bold bg-emerald-50/15">
                        {row.besGold > 0 ? formatWeight(row.besGold).replace(" گرم", "") : "۰"}
                      </td>
                      
                      {/* Signed Running Gold Balance matching PDF exact representation style */}
                      <td className={`py-3 px-2 font-mono font-black text-[10.5px] bg-slate-50 ${row.goldBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatWeight(row.goldBalance)}
                        <span className="text-[8px] font-sans font-extrabold mr-1">
                          {row.goldBalance >= 0 ? "(بد)" : "(بس)"}
                        </span>
                      </td>

                      {/* Swapped Bed/Bes Riyal cash columns */}
                      <td className="py-3 px-2 text-rose-750 font-mono font-bold bg-rose-50/15">
                        {row.bidIRR > 0 ? formatCurrency(row.bidIRR).replace(" ریال", "") : "۰"}
                      </td>
                      <td className="py-3 px-2 text-emerald-750 font-mono font-bold bg-emerald-50/15">
                        {row.besIRR > 0 ? formatCurrency(row.besIRR).replace(" ریال", "") : "۰"}
                      </td>
                      
                      {/* Signed Running Riyal Balance matching PDF exact representation style */}
                      <td className={`py-3 px-2 font-mono font-black text-[10.5px] bg-slate-50 ${row.irrBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatCurrency(row.irrBalance)}
                        <span className="text-[8px] font-sans font-extrabold mr-1">
                          {row.irrBalance >= 0 ? "(بد)" : "(بس)"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer containing total aggregates precisely like the bottom of page 5 of physical PDF */}
          {activeLedgerData.length > 0 && (
            <div className="border-t-4 border-double border-slate-950 pt-5 mt-4 space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                جمع نهایی تراز کل صورت‌حساب معین (طرف همکار)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold font-mono">
                {/* Gold aggregates summary */}
                <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>جمع کل بدهکار طلا (گرم):</span>
                    <span className="text-rose-700">
                      {formatWeight(activeLedgerData.reduce((sum, r) => sum + r.bidGold, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>جمع کل بستانکار طلا (گرم):</span>
                    <span className="text-emerald-700">
                      {formatWeight(activeLedgerData.reduce((sum, r) => sum + r.besGold, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-slate-900 text-sm">
                    <span>مانده نهایی حساب طلایی:</span>
                    {(() => {
                      const finalGoldBal = activeLedgerData[0]?.goldBalance || 0;
                      return (
                        <span className={`font-black ${finalGoldBal >= 0 ? "text-emerald-650" : "text-rose-650"}`}>
                          {formatWeight(finalGoldBal)} ({finalGoldBal >= 0 ? "بدهکار" : "بستانکار"})
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Cash Riyal aggregates summary */}
                <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>جمع کل بدهکار ریالی:</span>
                    <span className="text-rose-700">
                      {formatCurrency(activeLedgerData.reduce((sum, r) => sum + r.bidIRR, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>جمع کل بستانکار ریالی:</span>
                    <span className="text-emerald-700">
                      {formatCurrency(activeLedgerData.reduce((sum, r) => sum + r.besIRR, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-slate-900 text-sm">
                    <span>مانده نهایی حساب ریالی:</span>
                    {(() => {
                      const finalIrrBal = activeLedgerData[0]?.irrBalance || 0;
                      return (
                        <span className={`font-black ${finalIrrBal >= 0 ? "text-emerald-650" : "text-rose-650"}`}>
                          {formatCurrency(finalIrrBal)} ({finalIrrBal >= 0 ? "بدهکار" : "بستانکار"})
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
