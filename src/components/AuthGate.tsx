import React, { useState } from "react";
import { SignIn, UserPlus, CircleNotch, WarningCircle, Key } from "@phosphor-icons/react";

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
    <div
      className="min-h-screen bg-[#f8fafc] bg-cover bg-center bg-no-repeat flex flex-col justify-center items-center p-4 animate-fadeIn"
      style={{ backgroundImage: "url('/brand/login-bg.webp')" }}
      dir="rtl"
    >
      <div className="w-full max-w-sm">
        {/* لوگو و عنوان */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <img
            src="/brand/logo.png"
            alt=""
            width={72}
            height={72}
            className="w-[72px] h-[72px] object-contain drop-shadow-sm"
          />
          <h1 className="text-sm font-bold text-slate-900 text-center">
            سیستم مدیریت و حسابداری طلا
          </h1>
          <p className="text-[11px] text-slate-500 font-semibold text-center">
            برای دیدن اطلاعات خود وارد حساب کاربری‌تان شوید
          </p>
        </div>

        {/* کارت فرم */}
        <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200 shadow-sm p-5">
          {/* سوییچ ورود / ثبت‌نام */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded mb-5">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`py-2.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ورود
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`py-2.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ساخت حساب
            </button>
          </div>

          {mode === "register" && !canRegister ? (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-[11px] font-semibold text-blue-800 leading-relaxed">
              <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{signupReason || "ساخت حساب جدید در حال حاضر بسته است."}</span>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">نام کاربری</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  placeholder="erfan"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded text-xs font-semibold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">رمز عبور</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded text-xs font-semibold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  required
                />
                {mode === "register" && (
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">حداقل ۶ کاراکتر</p>
                )}
              </div>

              {mode === "register" && signupNeedsCode && (
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-500" />
                    کد دعوت
                  </label>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded text-xs font-semibold text-left focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    همان مقداری که در متغیر SIGNUP_CODE تنظیم شده است
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded text-[11px] font-semibold text-rose-700 leading-relaxed">
                  <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all"
              >
                {busy ? (
                  <CircleNotch className="w-4 h-4 animate-spin" />
                ) : mode === "login" ? (
                  <SignIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {mode === "login" ? "ورود به حساب" : "ساخت حساب و ورود"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-600 font-semibold mt-5 leading-relaxed bg-white/70 backdrop-blur-sm rounded py-2 px-3">
          اطلاعات هر حساب کاملاً جداست و فقط با همان نام کاربری قابل دیدن است.
        </p>
      </div>
    </div>
  );
}
