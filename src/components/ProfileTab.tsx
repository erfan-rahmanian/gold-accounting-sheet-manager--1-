import React, { useState } from "react";
import { UserGear, Key, CheckCircle, WarningCircle, CircleNotch, FloppyDisk, ShieldCheck } from "@phosphor-icons/react";
import BrandIcon from "./BrandIcon";

interface ProfileTabProps {
  /** نام کاربری فعلی */
  username: string;
  /** بعد از تغییر موفق نام کاربری صدا زده می‌شود */
  onUsernameChanged: (next: string) => void;
}

const inputClass =
  "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-left focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500";
const labelClass = "block text-[11px] font-extrabold text-slate-700 mb-1.5";

export default function ProfileTab({ username, onUsernameChanged }: ProfileTabProps) {
  // --- تغییر نام کاربری ---
  const [newUsername, setNewUsername] = useState(username);
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameDone, setUsernameDone] = useState(false);

  // --- تغییر رمز عبور ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  const submitUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setUsernameDone(false);
    setUsernameBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "username",
          newUsername: newUsername.trim(),
          password: usernamePassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUsernameError(data.error || "تغییر نام کاربری انجام نشد.");
        return;
      }
      setUsernameDone(true);
      setUsernamePassword("");
      onUsernameChanged(data.user);
    } catch {
      setUsernameError("ارتباط با سرور برقرار نشد.");
    } finally {
      setUsernameBusy(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordDone(false);

    if (newPassword !== repeatPassword) {
      setPasswordError("رمز عبور جدید و تکرار آن یکسان نیستند.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setPasswordBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password",
          password: currentPassword,
          newPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(data.error || "تغییر رمز عبور انجام نشد.");
        return;
      }
      setPasswordDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch {
      setPasswordError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn" dir="rtl">
      {/* سربرگ */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-amber-500/15 border border-amber-200 rounded-xl flex items-center justify-center shrink-0">
          <BrandIcon name="profile" size={22} />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 leading-none mb-1">پروفایل و تنظیمات حساب</h2>
          <p className="text-[11px] text-slate-500 font-bold">نام کاربری و رمز عبور خود را اینجا تغییر دهید</p>
        </div>
      </div>

      {/* حساب فعلی */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 text-sm font-black shrink-0 uppercase shadow-sm">
            {username.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-slate-400 font-bold leading-none mb-1.5">حساب فعلی</div>
            <div className="text-xs font-black text-slate-900 truncate" dir="ltr">{username}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* تغییر نام کاربری */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserGear className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">تغییر نام کاربری</h3>
          </div>

          <form onSubmit={submitUsername} className="space-y-3">
            <div>
              <label className={labelClass}>نام کاربری جدید</label>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                dir="ltr"
                autoComplete="username"
                className={inputClass}
                required
              />
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                ۳ تا ۳۲ کاراکتر؛ حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط
              </p>
            </div>

            <div>
              <label className={labelClass}>رمز عبور فعلی</label>
              <input
                type="password"
                value={usernamePassword}
                onChange={e => setUsernamePassword(e.target.value)}
                dir="ltr"
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
                required
              />
            </div>

            {usernameError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 leading-relaxed">
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{usernameError}</span>
              </div>
            )}

            {usernameDone && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-700 leading-relaxed">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>نام کاربری با موفقیت تغییر کرد. از این به بعد با همین نام وارد شوید.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={usernameBusy || newUsername.trim() === username}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all"
            >
              {usernameBusy ? <CircleNotch className="w-4 h-4 animate-spin" /> : <FloppyDisk className="w-4 h-4" />}
              ذخیره نام کاربری
            </button>
          </form>
        </div>

        {/* تغییر رمز عبور */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">تغییر رمز عبور</h3>
          </div>

          <form onSubmit={submitPassword} className="space-y-3">
            <div>
              <label className={labelClass}>رمز عبور فعلی</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                dir="ltr"
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>رمز عبور جدید</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClass}
                required
              />
              <p className="text-[10px] text-slate-400 font-bold mt-1">حداقل ۶ کاراکتر</p>
            </div>

            <div>
              <label className={labelClass}>تکرار رمز عبور جدید</label>
              <input
                type="password"
                value={repeatPassword}
                onChange={e => setRepeatPassword(e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClass}
                required
              />
            </div>

            {passwordError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 leading-relaxed">
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordDone && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-700 leading-relaxed">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>رمز عبور با موفقیت تغییر کرد.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={passwordBusy}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-sm active:scale-[0.98] transition-all"
            >
              {passwordBusy ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              ذخیره رمز عبور
            </button>
          </form>
        </div>
      </div>

      {/* یادداشت امنیتی */}
      <div className="flex items-start gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-600 leading-relaxed">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
        <span>
          برای هر دو تغییر، رمز عبور فعلی لازم است. اسناد و دفاتر شما با تغییر نام کاربری
          دست‌نخورده منتقل می‌شوند و چیزی از دست نمی‌رود.
        </span>
      </div>
    </div>
  );
}
