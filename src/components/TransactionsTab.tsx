import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, Coins, CheckCircle2, AlertTriangle, Tag, Trash2 } from "lucide-react";
import { AppSettings, Transaction, TRANSACTION_TYPES } from "../types";
import { calculateTransactionFields, formatCurrency, formatWeight, getTodayJalali, toPersianDigits, formatInputWithCommas } from "../utils";

declare global {
  interface Window {
    jalaliDatepicker: {
      startWatch: (options?: Record<string, unknown>) => void;
      show: (input: HTMLElement) => void;
      hide: () => void;
      updateOptions: (options: Record<string, unknown>) => void;
    };
  }
}

interface TransactionsTabProps {
  settings: AppSettings;
  transactions: Transaction[];
  onAddTransaction: (tx: Transaction) => Promise<void>;
  onRemoveTransaction?: (id: string) => Promise<void>;
}

export default function TransactionsTab({
  settings,
  transactions,
  onAddTransaction,
  onRemoveTransaction
}: TransactionsTabProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Transition animation for adding transactions
  const [showAddForm, setShowAddForm] = useState(false);

  // New Transaction draft state
  const [txDate, setTxDate] = useState(getTodayJalali());
  const [txShop, setTxShop] = useState(settings.shops[0]?.name || "");
  const [txType, setTxType] = useState<string>("خرید طلا");
  const [txSubType, setTxSubType] = useState("");
  const [txCoinType, setTxCoinType] = useState(settings.coins[0]?.name || "");
  const [txCoinCount, setTxCoinCount] = useState("");
  const [txPerson, setTxPerson] = useState(settings.persons[0] || "");
  const [txGoldWeight, setTxGoldWeight] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txSalesAmount, setTxSalesAmount] = useState("");
  const [txNote, setTxNote] = useState("");

  // Manual values for document (سند حسابداری)
  const [manualGoldCredit, setManualGoldCredit] = useState("");
  const [manualGoldDebit, setManualGoldDebit] = useState("");
  const [manualIRRCredit, setManualIRRCredit] = useState("");
  const [manualIRRDebit, setManualIRRDebit] = useState("");
  const [manualProfit, setManualProfit] = useState("");

  useEffect(() => {
    // Sync defaults if they load late
    if (settings.shops.length && !txShop) setTxShop(settings.shops[0].name);
    if (settings.persons.length && !txPerson) setTxPerson(settings.persons[0]);
  }, [settings]);

  const coinTypesForBuySell = ["سکه کامل", "نیم سکه", "ربع سکه"];
  useEffect(() => {
    if ((txType === "خرید سکه" || txType === "فروش سکه") && !coinTypesForBuySell.includes(txCoinType)) {
      setTxCoinType("سکه کامل");
    } else if ((txType === "دریافت سکه" || txType === "پرداخت سکه") && coinTypesForBuySell.includes(txCoinType)) {
      setTxCoinType(settings.coins[0]?.name || "");
    }
  }, [txType]);

  const dateRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.jalaliDatepicker) {
      window.jalaliDatepicker.startWatch({
        persianDigits: false,
        separatorChars: { date: "/" },
        autoShow: true,
        autoHide: true,
        hideAfterChange: true,
        date: true,
        time: false
      });
    }
  }, []);

  useEffect(() => {
    const input = dateRef.current;
    if (!input) return;
    const handler = () => {
      if (input.value) setTxDate(input.value);
    };
    input.addEventListener("change", handler);
    return () => input.removeEventListener("change", handler);
  }, [showAddForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Draft item
    const draftTx: Partial<Transaction> = {
      id: "tx-" + Date.now(),
      date: txDate,
      shop: txShop,
      type: txType,
      subType: txSubType,
      coinType: txCoinType,
      coinCount: Number(txCoinCount) || 0,
      person: txPerson,
      goldWeight: Number(txGoldWeight) || 0,
      amount: Number(txAmount) || 0,
      salesAmount: Number(txSalesAmount) || 0,
      note: txNote,
      // Manual bindings for ledger support "سند حسابداری"
      goldCredit: Number(manualGoldCredit) || 0,
      goldDebit: Number(manualGoldDebit) || 0,
      irrCredit: Number(manualIRRCredit) || 0,
      irrDebit: Number(manualIRRDebit) || 0,
      profit: Number(manualProfit) || 0
    };

    // Auto-calculate outputs using gold standard formula ruleset
    const finalizedTx = calculateTransactionFields(draftTx, settings.coins) as Transaction;
    
    await onAddTransaction(finalizedTx);

    // Reset draft fields
    setTxGoldWeight("");
    setTxAmount("");
    setTxSalesAmount("");
    setTxNote("");
    setManualGoldCredit("");
    setManualGoldDebit("");
    setManualIRRCredit("");
    setManualIRRDebit("");
    setManualProfit("");
    setShowAddForm(false);
  };

  // Filters logic
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.note?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tx.person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tx.shop?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tx.type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Helper to filter numeric strings cleanly
  const cleanNumInput = (val: string) => {
    return val.replace(/[^0-9.]/g, "");
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Search and Filters panel - Mobile first grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-4 shadow-sm">
        <div className="grid grid-cols-1 items-center gap-3 w-full text-xs">
          {/* Quick Search */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              placeholder="جستجو در نام شخص، توضیحات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>
        </div>

        {/* Action Toggle Form - High-Contrast yellow button with comfortable touch size */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full bg-amber-500 text-slate-950 font-extrabold px-6 py-3.5 rounded-2xl text-xs hover:bg-amber-400 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm shadow-amber-500/20 min-h-[44px]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          {showAddForm ? "بستن فرم ثبت تراکنش" : "ثبت تراکنش حسابداری طلا"}
        </button>
      </div>

      {/* Slide down Add form in Light mode, fully mobile responsive with decimal numeric inputs */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-md text-xs space-y-4 max-w-4xl mx-auto animate-fadeIn">
          <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Coins className="w-4.5 h-4.5 text-amber-500" />
            سند جدید حسابداری طلا
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Date entry */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">تاریخ معامله (جلالی)</label>
              <input
                ref={dateRef}
                type="text"
                data-jdp
                data-jdp-only-date
                readOnly
                value={txDate}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-900 text-left font-mono font-medium focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              />
            </div>

            {/* Shop select */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">مغازه / صندوق مربوطه</label>
              <select
                value={txShop}
                onChange={(e) => setTxShop(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-900 font-medium focus:outline-none focus:border-amber-500 text-xs h-[44px]"
              >
                {settings.shops.length === 0 ? (
                  <option value="">ابتدا مغازه را ثبت کنید</option>
                ) : (
                  settings.shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                )}
              </select>
            </div>

            {/* Trade category */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">نوع معامله</label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-amber-600 font-bold focus:outline-none focus:border-amber-500 text-xs h-[44px]"
              >
                {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Account person */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">طرف حساب (شخص ذینفع)</label>
              <select
                value={txPerson}
                onChange={(e) => setTxPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-900 font-medium focus:outline-none focus:border-amber-500 text-xs h-[44px]"
              >
                {settings.persons.length === 0 ? (
                  <option value="">ابتدا شخص ذینفع را ثبت کنید</option>
                ) : (
                  settings.persons.map(p => <option key={p} value={p}>{p}</option>)
                )}
              </select>
            </div>
          </div>

          {/* Dynamic parameter forms depend on Trade Category - All Inputs use Mobile Decimal Keyboards with clean validation */}
          <div className="bg-slate-50 p-4 font-medium rounded-2xl border border-slate-200/80 space-y-4">
            <h4 className="text-amber-700 font-bold text-[11px] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-500" /> فیلدهای آماری مربوط به "{txType}"
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Gold Weight Entry */}
              {(txType === "خرید طلا" || txType === "فروش طلا" || txType === "خرید و فروش" || txType === "خرید و فروش (امروزی)" || txType === "خرید و فروش (فردایی)" || txType === "دریافت آبشده" || txType === "پرداخت آبشده" || txType === "آبشده") && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-slate-600">وزن فیزیکی طلا آبشده (گرم)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={formatInputWithCommas(txGoldWeight)}
                    onChange={(e) => setTxGoldWeight(cleanNumInput(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 text-left font-mono font-semibold"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Coin parameter forms */}
              {(txType === "دریافت سکه" || txType === "پرداخت سکه" || txType === "خرید سکه" || txType === "فروش سکه") && (
                <>
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-slate-600 font-medium">نوع سکه</label>
                    <select
                      value={txCoinType}
                      onChange={(e) => setTxCoinType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-xs h-[40px] font-semibold"
                    >
                      {(txType === "خرید سکه" || txType === "فروش سکه") ? (
                        coinTypesForBuySell.map(t => <option key={t} value={t}>{t}</option>)
                      ) : (
                        settings.coins.map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-slate-600 font-medium">تعداد سکه (بسته یا عدد)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.,]*"
                      value={formatInputWithCommas(txCoinCount)}
                      onChange={(e) => setTxCoinCount(cleanNumInput(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-left font-mono font-semibold"
                      placeholder="1"
                    />
                  </div>
                </>
              )}

              {/* Riyal Amount (Purchase, receiving gold/money, etc) */}
              {(txType !== "سند حسابداری") && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-slate-600">
                    {txType === "خرید سکه" ? "مبلغ خرید (ریال)" : txType === "فروش سکه" ? "مبلغ فروش (ریال)" : txType.includes("خرید و فروش") ? "مبلغ خرید (ریال)" : "مبلغ سند (ریال)"}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={formatInputWithCommas(txAmount)}
                    onChange={(e) => setTxAmount(cleanNumInput(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 text-left font-mono font-semibold"
                    placeholder="0"
                  />
                  {Number(txAmount) > 0 && (
                    <span className="text-[10px] text-slate-500 font-semibold mt-1 block leading-relaxed">
                      ارزش: {formatCurrency(Number(txAmount))}
                    </span>
                  )}
                </div>
              )}

              {/* Sales Amount (Purchase and sales today/tomorrow) */}
              {(txType === "خرید و فروش" || txType === "خرید و فروش (امروزی)" || txType === "خرید و فروش (فردایی)") && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-slate-600">مبلغ فروش (ریال)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={formatInputWithCommas(txSalesAmount)}
                    onChange={(e) => setTxSalesAmount(cleanNumInput(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 text-left font-mono font-semibold"
                    placeholder="0"
                  />
                  {Number(txSalesAmount) - Number(txAmount) !== 0 && (
                    <span className={`text-[10px] font-bold mt-1 block ${Number(txSalesAmount) - Number(txAmount) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      سود برآوردی صنف: {formatCurrency(Number(txSalesAmount) - Number(txAmount))}
                    </span>
                  )}
                </div>
              )}

              {/* Manual inputs for general ledger (سند حسابداری) */}
              {txType === "سند حسابداری" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-amber-600">بستانکاری طلا (گرم) - دستی</label>
                    <input type="text" inputMode="decimal" pattern="[0-9.,]*" value={formatInputWithCommas(manualGoldCredit)} onChange={e => setManualGoldCredit(cleanNumInput(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-left font-mono font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-rose-600">بدهکاری طلا (گرم) - دستی</label>
                    <input type="text" inputMode="decimal" pattern="[0-9.,]*" value={formatInputWithCommas(manualGoldDebit)} onChange={e => setManualGoldDebit(cleanNumInput(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-left font-mono font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-emerald-600">بستانکاری ریال - دستی</label>
                    <input type="text" inputMode="decimal" pattern="[0-9.,]*" value={formatInputWithCommas(manualIRRCredit)} onChange={e => setManualIRRCredit(cleanNumInput(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-left font-mono font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-rose-600">بدهکاری ریال - دستی</label>
                    <input type="text" inputMode="decimal" pattern="[0-9.,]*" value={formatInputWithCommas(manualIRRDebit)} onChange={e => setManualIRRDebit(cleanNumInput(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-left font-mono font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-700">سود/زیان ریال - دستی</label>
                    <input type="text" inputMode="decimal" pattern="[0-9.,]*" value={formatInputWithCommas(manualProfit)} onChange={e => setManualProfit(cleanNumInput(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-left font-mono font-semibold" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-600 font-bold">توضیحات و جزئیات سند</label>
            <input
              type="text"
              placeholder="شرح کامل آمار معامله در دفتر..."
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="bg-amber-500 text-slate-950 font-extrabold px-8 py-3.5 rounded-2xl text-xs hover:bg-amber-400 cursor-pointer transition-all flex items-center gap-2 shadow-sm shadow-amber-500/20 active:scale-[0.98] min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              ثبت نهایی و سند زدن در دفتر حسابداری طلا
            </button>
          </div>
        </form>
      )}

      {/* Main ledger journal table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden p-4 md:p-6">
        <h3 className="text-sm font-extrabold text-slate-905 text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Coins className="w-5 h-5 text-amber-500" />
          ریزمجموعه اسناد حسابداری دفتر طلا
        </h3>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto" />
            <p className="text-xs font-bold">هیچ سندی در این گروه تراکنش یافت نشد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs min-w-[900px] border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 pb-3 font-semibold">
                  <th className="py-3 px-1 text-center w-8">ردیف</th>
                  <th className="py-3 px-2 w-20">تاریخ</th>
                  <th className="py-3 px-2">مغازه</th>
                  <th className="py-3 px-2">نوع معامله</th>
                  <th className="py-3 px-2">شخص طرف‌حساب</th>
                  <th className="py-3 px-2">پارامترهای فنی (آبشده/سکه)</th>
                  <th className="py-3 px-2 text-emerald-600">بستانکاری طلا</th>
                  <th className="py-3 px-2 text-rose-600">بدهکاری طلا</th>
                  <th className="py-3 px-2 text-emerald-600">بستانکاری ریال</th>
                  <th className="py-3 px-2 text-rose-600">بدهکاری ریال</th>
                  <th className="py-3 px-2 text-amber-600">سود/زیان</th>
                  <th className="py-3 px-2 max-w-[150px]">توضیحات</th>
                  {onRemoveTransaction && <th className="py-3 px-2 text-center w-16">عملیات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-1 text-center text-slate-400 font-mono font-medium">{toPersianDigits(idx + 1)}</td>
                    <td className="py-3 px-2 text-slate-600 font-mono font-semibold">{tx.date}</td>
                    <td className="py-3 px-2 font-bold text-slate-800">{tx.shop}</td>
                    <td className="py-3 px-2">
                      <span className="inline-block bg-amber-500/10 text-amber-700 font-bold px-2 py-1 rounded text-[10px] border border-amber-500/10">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-bold text-slate-800">{tx.person}</td>
                    <td className="py-3 px-2 text-[10px] text-slate-500 leading-relaxed font-mono">
                      {tx.goldWeight > 0 && <div>آبشده: {formatWeight(tx.goldWeight)}</div>}
                      {tx.coinType && (
                        <div className="font-sans font-bold">
                          {tx.coinType} ({toPersianDigits(tx.coinCount)} عدد)
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-emerald-600 font-extrabold font-mono text-[11.5px]">
                      {tx.goldCredit > 0 ? formatWeight(tx.goldCredit) : "-"}
                    </td>
                    <td className="py-3 px-2 text-rose-600 font-extrabold font-mono text-[11.5px]">
                      {tx.goldDebit > 0 ? formatWeight(tx.goldDebit) : "-"}
                    </td>
                    <td className="py-3 px-2 text-emerald-600 font-extrabold font-mono text-[11.5px]">
                      {tx.irrCredit > 0 ? formatCurrency(tx.irrCredit) : "-"}
                    </td>
                    <td className="py-3 px-2 text-rose-600 font-extrabold font-mono text-[11.5px]">
                      {tx.irrDebit > 0 ? formatCurrency(tx.irrDebit) : "-"}
                    </td>
                    <td className={`py-3 px-2 font-black font-mono text-[11.5px] ${tx.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.profit !== 0 ? formatCurrency(tx.profit) : "-"}
                    </td>
                    <td className="py-3 px-2 text-slate-500 max-w-[150px] truncate font-medium" title={tx.note}>
                      {tx.note || "-"}
                    </td>
                    {onRemoveTransaction && (
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => {
                            if (window.confirm("آیا از حذف این سند حسابداری طلا اطمینان کامل دارید؟")) {
                              onRemoveTransaction(tx.id);
                            }
                          }}
                          className="text-rose-500 hover:text-white border border-rose-100 hover:border-rose-500 bg-rose-50 hover:bg-rose-500 p-1.5 rounded-lg cursor-pointer transition-all inline-flex items-center justify-center"
                          title="حذف سند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
