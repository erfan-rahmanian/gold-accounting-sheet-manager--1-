import React, { useState } from "react";
import { Settings, Plus, Trash2, ShoppingBag, Users, Coins as CoinIcon, CheckCircle2, RotateCcw, Save, X } from "lucide-react";
import { AppSettings, Shop, Coin, Person } from "../types";
import { formatCurrency, formatWeight, toPersianDigits, formatInputWithCommas } from "../utils";

const DEFAULT_COINS: Coin[] = [
  { name: "سکه 86", weight: 9.756 },
  { name: "سکه پایین", weight: 9.756 },
  { name: "نیم سکه 86", weight: 4.8792 },
  { name: "نیم پایین", weight: 4.8792 },
  { name: "ربع سکه 86", weight: 2.440 },
  { name: "ربع پایین", weight: 2.440 }
];

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
}

export default function SettingsTab({ settings, onUpdateSettings }: SettingsTabProps) {
  const [currentGoldPrice, setCurrentGoldPrice] = useState(settings.currentGoldPrice.toString());
  const [shops, setShops] = useState<Shop[]>(settings.shops);
  const [persons, setPersons] = useState<Person[]>(settings.persons);
  const [coins, setCoins] = useState<Coin[]>(settings.coins);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editingCoinIdx, setEditingCoinIdx] = useState<number | null>(null);
  const [editingWeightValue, setEditingWeightValue] = useState("");

  const persistSettings = async (patch: Partial<AppSettings>) => {
    const updated = {
      shops,
      persons,
      coins,
      currentGoldPrice: Number(currentGoldPrice) || 0,
      spreadsheetId: settings.spreadsheetId,
      ...patch
    };
    await onUpdateSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // New item draft states (use string for easy decimal input)
  const [newShopName, setNewShopName] = useState("");
  const [newShopGold, setNewShopGold] = useState("");
  const [newShopIrr, setNewShopIrr] = useState("");
  const [newShopNote, setNewShopNote] = useState("");

  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonGold, setNewPersonGold] = useState("");
  const [newPersonIrr, setNewPersonIrr] = useState("");
  const [newPersonNote, setNewPersonNote] = useState("");

  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editPersonName, setEditPersonName] = useState("");
  const [editPersonGold, setEditPersonGold] = useState("");
  const [editPersonIrr, setEditPersonIrr] = useState("");
  const [editPersonNote, setEditPersonNote] = useState("");

  const handleAddShop = async () => {
    if (!newShopName.trim()) return;
    const newShop: Shop = {
      id: Math.random().toString(),
      name: newShopName.trim(),
      initialGold: Number(newShopGold) || 0,
      initialIRR: Number(newShopIrr) || 0,
      note: newShopNote.trim()
    };
    const updated = [...shops, newShop];
    setShops(updated);
    setNewShopName("");
    setNewShopGold("");
    setNewShopIrr("");
    setNewShopNote("");
    await persistSettings({ shops: updated });
  };

  const handleRemoveShop = async (id: string) => {
    const updated = shops.filter(s => s.id !== id);
    setShops(updated);
    await persistSettings({ shops: updated });
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim() || persons.some(p => p.name === newPersonName.trim())) return;
    const newPerson: Person = {
      id: Math.random().toString(),
      name: newPersonName.trim(),
      initialGold: Number(newPersonGold) || 0,
      initialIRR: Number(newPersonIrr) || 0,
      initialProfit: 0,
      note: newPersonNote.trim()
    };
    const updated = [...persons, newPerson];
    setPersons(updated);
    setNewPersonName("");
    setNewPersonGold("");
    setNewPersonIrr("");
    setNewPersonNote("");
    await persistSettings({ persons: updated });
  };

  const handleRemovePerson = async (id: string) => {
    const updated = persons.filter(p => p.id !== id);
    setPersons(updated);
    await persistSettings({ persons: updated });
  };

  const handleStartEditPerson = (person: Person) => {
    setEditingPersonId(person.id);
    setEditPersonName(person.name);
    setEditPersonGold(person.initialGold.toString());
    setEditPersonIrr(person.initialIRR.toString());
    setEditPersonNote(person.note);
  };

  const handleCancelEditPerson = () => {
    setEditingPersonId(null);
    setEditPersonName("");
    setEditPersonGold("");
    setEditPersonIrr("");
    setEditPersonNote("");
  };

  const handleSaveEditPerson = async (id: string) => {
    const updated = persons.map(p =>
      p.id === id
        ? {
            ...p,
            name: editPersonName.trim() || p.name,
            initialGold: Number(editPersonGold) || 0,
            initialIRR: Number(editPersonIrr) || 0,
            note: editPersonNote.trim()
          }
        : p
    );
    setPersons(updated);
    setEditingPersonId(null);
    setEditPersonName("");
    setEditPersonGold("");
    setEditPersonIrr("");
    setEditPersonNote("");
    await persistSettings({ persons: updated });
  };

  const handleStartEditCoin = (index: number) => {
    setEditingCoinIdx(index);
    setEditingWeightValue(coins[index].weight.toString());
  };

  const handleCancelEditCoin = () => {
    setEditingCoinIdx(null);
    setEditingWeightValue("");
  };

  const handleSaveEditCoin = async (index: number) => {
    const updated = [...coins];
    const cleanWeight = Number(editingWeightValue.replace(/[^0-9.]/g, "")) || 0;
    updated[index] = { ...updated[index], weight: cleanWeight };
    setCoins(updated);
    setEditingCoinIdx(null);
    setEditingWeightValue("");
    await persistSettings({ coins: updated });
  };

  const handleCoinWeightInput = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    setEditingWeightValue(cleaned);
  };

  const handleResetCoinWeights = async () => {
    const updated = DEFAULT_COINS.map(dc => {
      const existing = coins.find(c => c.name === dc.name);
      return existing ? { ...existing, weight: dc.weight } : dc;
    });
    const existingExtra = coins.filter(c => !DEFAULT_COINS.some(dc => dc.name === c.name));
    const merged = [...updated, ...existingExtra];
    setCoins(merged);
    setEditingCoinIdx(null);
    setEditingWeightValue("");
    await persistSettings({ coins: merged });
  };

  const handleGoldPriceChange = async (val: string) => {
    setCurrentGoldPrice(val);
    await persistSettings({ currentGoldPrice: Number(val) || 0 });
  };

  const cleanNumInput = (val: string) => {
    const cleaned = val.replace(/[^0-9.\-]/g, "");
    if (cleaned.indexOf("-") > 0) return cleaned.replace(/-/g, "");
    return cleaned;
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Top action header for saving */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl">
            <Settings className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">تنظیمات پایه دفاتر حسابداری</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">افزودن فروشگاه، اشخاص ذینفع، کالیبراسیون سکه و قیمت طلا</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {saveSuccess && (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold ml-2">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> ذخیره شد
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coin Weights Customizer */}
        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
              <CoinIcon className="w-4 h-4 text-amber-500" />
              وزن استاندارد سکه‌ها (امکان کالیبراسیون دستی)
            </h3>
            <button
              onClick={handleResetCoinWeights}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              بازگشت به وزن پیش‌فرض
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {coins.map((coin, idx) => (
              <div key={coin.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">{coin.name}</span>
                <div className="flex items-center gap-2">
                  {editingCoinIdx === idx ? (
                    <>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.,]*"
                        autoFocus
                        value={editingWeightValue}
                        onChange={(e) => handleCoinWeightInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEditCoin(idx);
                          if (e.key === "Escape") handleCancelEditCoin();
                        }}
                        className="w-24 bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-left font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button
                        onClick={() => handleSaveEditCoin(idx)}
                        className="text-emerald-500 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="ذخیره"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCancelEditCoin}
                        className="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="لغو"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEditCoin(idx)}
                        className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-left font-mono font-bold text-slate-800 hover:border-amber-400 cursor-pointer transition-colors"
                      >
                        {coin.weight}
                      </button>
                      <span className="text-[10px] text-slate-400 font-bold">گرم</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shop List and Creation Container */}
        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <ShoppingBag className="w-4 h-4 text-amber-500" />
            مدیریت مغازه‌ها و انبارهای فیزیکی طلا
          </h3>
          
          {/* Shop insertion form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-bold text-slate-700">
            <div className="space-y-1.5">
              <label className="text-slate-500">نام مغازه جدید</label>
              <input
                type="text"
                placeholder="مثال: زرگری نوین"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">موجودی اولیه طلا (گرم)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={formatInputWithCommas(newShopGold)}
                onChange={(e) => setNewShopGold(cleanNumInput(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-left font-mono text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">موجودی اولیه ریال</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={formatInputWithCommas(newShopIrr)}
                onChange={(e) => setNewShopIrr(cleanNumInput(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-left font-mono text-xs focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end pt-1">
              <button
                onClick={handleAddShop}
                className="w-full sm:w-auto bg-amber-500 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:bg-amber-400"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" /> ثبت مغازه جدید
              </button>
            </div>
          </div>

          {/* Current shops display table */}
          <div className="overflow-x-auto text-[11px] w-full">
            <table className="w-full text-right min-w-[400px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 font-semibold">
                  <th className="pb-2">نام مغازه / صندوق</th>
                  <th className="pb-2">موجودی اولیه طلا</th>
                  <th className="pb-2">موجودی اولیه ریال</th>
                  <th className="pb-2 text-left w-12">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shops.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">مغازه‌ای ثبت نشده است</td>
                  </tr>
                ) : (
                  shops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 font-bold text-slate-800">{shop.name}</td>
                      <td className={`py-2.5 font-mono font-bold ${shop.initialGold >= 0 ? "text-amber-600" : "text-rose-600"}`}>{formatWeight(shop.initialGold)}</td>
                      <td className={`py-2.5 font-mono font-bold ${shop.initialIRR >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(shop.initialIRR)}</td>
                      <td className="py-2.5 text-left">
                        <button
                          onClick={() => handleRemoveShop(shop.id)}
                          className="text-rose-500 hover:text-white border border-rose-100 hover:border-rose-500 bg-rose-50 hover:bg-rose-500 p-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Persons management card (mirrors the shops management card) */}
        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Users className="w-4 h-4 text-amber-500" />
            مدیریت اشخاص ذینفع و همکاران (ثبت موجودی اولیه)
          </h3>

          {/* Person insertion form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-bold text-slate-700">
            <div className="space-y-1.5">
              <label className="text-slate-500">نام شخص جدید</label>
              <input
                type="text"
                placeholder="مثال: علی زرگر"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">موجودی اولیه طلا (گرم) - اختیاری</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={formatInputWithCommas(newPersonGold)}
                onChange={(e) => setNewPersonGold(cleanNumInput(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-left font-mono text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500">موجودی اولیه ریال - اختیاری</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={formatInputWithCommas(newPersonIrr)}
                onChange={(e) => setNewPersonIrr(cleanNumInput(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-left font-mono text-xs focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-slate-500">توضیحات / یادداشت - اختیاری</label>
              <input
                type="text"
                placeholder="توضیحات اختیاری..."
                value={newPersonNote}
                onChange={(e) => setNewPersonNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-1 flex items-end justify-end pt-1">
              <button
                onClick={handleAddPerson}
                className="w-full sm:w-auto bg-amber-500 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:bg-amber-400"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" /> ثبت شخص جدید
              </button>
            </div>
          </div>

          {/* Current persons table */}
          <div className="overflow-x-auto text-[11px] w-full">
            <table className="w-full text-right min-w-[500px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 font-semibold">
                  <th className="pb-2">نام شخص / همکار</th>
                  <th className="pb-2">موجودی اولیه طلا</th>
                  <th className="pb-2">موجودی اولیه ریال</th>
                  <th className="pb-2">توضیحات</th>
                  <th className="pb-2 text-left w-12">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {persons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">شخصی ثبت نشده است</td>
                  </tr>
                ) : (
                  persons.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      {editingPersonId === p.id ? (
                        <>
                          <td className="py-2">
                            <input
                              type="text"
                              value={editPersonName}
                              onChange={(e) => setEditPersonName(e.target.value)}
                              className="w-full bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formatInputWithCommas(editPersonGold)}
                              onChange={(e) => setEditPersonGold(cleanNumInput(e.target.value))}
                              className="w-full bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-left font-mono text-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formatInputWithCommas(editPersonIrr)}
                              onChange={(e) => setEditPersonIrr(cleanNumInput(e.target.value))}
                              className="w-full bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-left font-mono text-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              value={editPersonNote}
                              onChange={(e) => setEditPersonNote(e.target.value)}
                              className="w-full bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-left flex items-center gap-1.5">
                            <button
                              onClick={() => handleSaveEditPerson(p.id)}
                              className="text-emerald-600 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="ذخیره"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancelEditPerson}
                              className="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="لغو"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 font-bold text-slate-800">{p.name}</td>
                          <td className={`py-2.5 font-mono font-bold ${p.initialGold >= 0 ? "text-amber-600" : "text-rose-600"}`}>{formatWeight(p.initialGold)}</td>
                          <td className={`py-2.5 font-mono font-bold ${p.initialIRR >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(p.initialIRR)}</td>
                          <td className="py-2.5 text-slate-400 max-w-[160px] truncate" title={p.note}>{p.note || "-"}</td>
                          <td className="py-2.5 text-left flex items-center gap-1.5">
                            <button
                              onClick={() => handleStartEditPerson(p)}
                              className="text-amber-600 hover:bg-amber-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="ویرایش"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemovePerson(p.id)}
                              className="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
