import React, { useState } from "react";
import { Coins, LogIn, UserPlus, Loader2, AlertCircle, KeyRound } from "lucide-react";

interface AuthGateProps {
  /** آیا ساخت حساب جدید در حال حاضر مجاز است */
  signupOpen: boolean;
  /** آیا برای ساخت حساب کد دعوت لازم است */
  signupNeedsCode: boolean;
  /** دلیل بسته بودن ثبت‌نام (اگر بسته باشد) */
  signupReason?: string;
  onAuthenticated: (username: string) => void;
}

export default function AuthGate({
  signupOpen,
  signupNeedsCode,
  signupReason,
  onAuthenticated
}: AuthGateProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          username: username.trim(),
          password,
          ...(mode === "register" && signupNeedsCode ? { code } : {})
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "خطا در ورود به سیستم.");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  };

  const canRegister = signupOpen;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 animate-fadeIn" dir="rtl">
      <div className="w-full max-w-sm">
        {/* لوگو و عنوان */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-2xl flex items-center justify-center text-slate-950 shadow-md">
            <Coins className="w-7 h-7" />
          </div>
          <h1 className="text-sm font-black text-slate-900 text-center">
            سیستم مدیریت و حسابداری طلا
          </h1>
          <p className="text-[11px] text-slate-500 font-bold text-center">
            برای دیدن اطلاعات خود وارد حساب کاربری‌تان شوید
          </p>
        </div>

        {/* کارت فرم */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          {/* سوییچ ورود / ثبت‌نام */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`py-2.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ورود
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              disabled={!canRegister}
              className={`py-2.5 rounded-lg text-[11px] font-extrabold transition-all ${
                !canRegister
                  ? "text-slate-300 cursor-not-allowed"
                  : mode === "register"
                    ? "bg-white text-slate-900 shadow-sm cursor-pointer"
                    : "text-slate-500 hover:text-slate-800 cursor-pointer"
              }`}
            >
              ساخت حساب
            </button>
          </div>

          {mode === "register" && !canRegister ? (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{signupReason || "ساخت حساب جدید در حال حاضر بسته است."}</span>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5">نام کاربری</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  placeholder="erfan"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-left focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5">رمز عبور</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-left focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                  required
                />
                {mode === "register" && (
                  <p className="text-[10px] text-slate-400 font-bold mt-1">حداقل ۶ کاراکتر</p>
                )}
              </div>

              {mode === "register" && signupNeedsCode && (
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 mb-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    کد دعوت
                  </label>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-left focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    همان مقداری که در متغیر SIGNUP_CODE تنظیم شده است
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === "login" ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {mode === "login" ? "ورود به حساب" : "ساخت حساب و ورود"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 font-bold mt-5 leading-relaxed">
          اطلاعات هر حساب کاملاً جداست و فقط با همان نام کاربری قابل دیدن است.
        </p>
      </div>
    </div>
  );
}
