import React, { useState } from "react";
import { Settings, Plus, Trash2, ShoppingBag, Users, Coins as CoinIcon, CheckCircle2 } from "lucide-react";
import { AppSettings, Shop, Coin } from "../types";
import { formatCurrency, formatWeight, toPersianDigits, formatInputWithCommas } from "../utils";

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
}

export default function SettingsTab({ settings, onUpdateSettings }: SettingsTabProps) {
  const [currentGoldPrice, setCurrentGoldPrice] = useState(settings.currentGoldPrice.toString());
  const [shops, setShops] = useState<Shop[]>(settings.shops);
  const [persons, setPersons] = useState<string[]>(settings.persons);
  const [coins, setCoins] = useState<Coin[]>(settings.coins);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    if (!newPersonName.trim() || persons.includes(newPersonName.trim())) return;
    const updated = [...persons, newPersonName.trim()];
    setPersons(updated);
    setNewPersonName("");
    await persistSettings({ persons: updated });
  };

  const handleRemovePerson = async (name: string) => {
    const updated = persons.filter(p => p !== name);
    setPersons(updated);
    await persistSettings({ persons: updated });
  };

  const handleCoinWeightChange = async (index: number, newWeightStr: string) => {
    const updated = [...coins];
    const cleanWeight = Number(newWeightStr.replace(/[^0-9.]/g, "")) || 0;
    updated[index] = { ...updated[index], weight: cleanWeight };
    setCoins(updated);
    await persistSettings({ coins: updated });
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
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <CoinIcon className="w-4 h-4 text-amber-500" />
            وزن استاندارد سکه‌ها (امکان کالیبراسیون دستی)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {coins.map((coin, idx) => (
              <div key={coin.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">{coin.name}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={coin.weight}
                    onChange={(e) => handleCoinWeightChange(idx, e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-left font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">گرم</span>
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

        {/* Persons list card */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Users className="w-4 h-4 text-amber-500" />
            مدیریت همکاران و اشخاص ذینفع
          </h3>

          <div className="flex gap-2 text-xs">
            <input
              type="text"
              placeholder="نام همکار جدید..."
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-bold"
            />
            <button
              onClick={handleAddPerson}
              className="bg-amber-500 text-slate-950 font-extrabold rounded-xl px-4 cursor-pointer hover:bg-amber-400 flex items-center justify-center min-h-[44px]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {persons.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">همکاری ثبت نشده است.</div>
            ) : (
              persons.map((p) => (
                <div key={p} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-800 font-bold">{p}</span>
                  <button
                    onClick={() => handleRemovePerson(p)}
                    className="text-rose-500 hover:bg-rose-100 p-1 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
