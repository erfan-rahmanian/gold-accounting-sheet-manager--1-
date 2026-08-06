import {
  Req,
  Res,
  send,
  readBody,
  loadAccounts,
  saveAccounts,
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  currentUser,
  signupPolicy,
  checkSignupCode,
  saveUserData,
  initialStateForNewAccount,
  USERNAME_RE,
  MIN_PASSWORD,
} from "./_lib/core.js";

/**
 * POST /api/auth  { action: "login" | "register" | "logout" | "me", ... }
 *
 * یک اندپوینت برای همه‌ی کارهای احراز هویت تا زیر سقف ۱۲ تابع
 * پلن رایگان ورسل بمانیم.
 */
export default async function handler(req: Req, res: Res) {
  try {
    if (req.method === "GET") {
      // وضعیت فعلی: آیا کاربر وارد شده؟ آیا ثبت‌نام باز است؟
      const accounts = await loadAccounts();
      const policy = signupPolicy(accounts.length);
      return send(res, 200, {
        user: currentUser(req),
        signup: { open: policy.open, needsCode: policy.needsCode, reason: policy.reason },
      });
    }

    if (req.method !== "POST") return send(res, 405, { error: "روش درخواست پشتیبانی نمی‌شود." });

    const body = await readBody(req);
    const action = String(body.action || "");

    if (action === "logout") {
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (action === "register") {
      const accounts = await loadAccounts();
      const policy = signupPolicy(accounts.length);
      if (!policy.open) return send(res, 403, { error: policy.reason });
      if (policy.needsCode && !checkSignupCode(body.code)) {
        return send(res, 403, { error: "کد دعوت نادرست است." });
      }
      if (!USERNAME_RE.test(username)) {
        return send(res, 400, {
          error: "نام کاربری باید ۳ تا ۳۲ کاراکتر و شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.",
        });
      }
      if (password.length < MIN_PASSWORD) {
        return send(res, 400, { error: `رمز عبور باید حداقل ${MIN_PASSWORD} کاراکتر باشد.` });
      }
      if (accounts.some(a => a.username.toLowerCase() === username.toLowerCase())) {
        return send(res, 409, { error: "این نام کاربری قبلاً گرفته شده است." });
      }

      const { salt, hash } = hashPassword(password);
      accounts.push({ username, salt, hash, createdAt: new Date().toISOString() });
      await saveAccounts(accounts);
      // اولین حساب، داده‌های نسخه‌ی قبلی (data.json) را به ارث می‌برد
      await saveUserData(username, initialStateForNewAccount(accounts.length === 1));

      setSessionCookie(res, signSession(username));
      return send(res, 200, { ok: true, user: username });
    }

    if (action === "login") {
      const accounts = await loadAccounts();
      const account = accounts.find(a => a.username.toLowerCase() === username.toLowerCase());
      // پیام یکسان برای کاربر ناموجود و رمز غلط، تا نشود نام کاربری‌ها را کشف کرد
      const fail = () => send(res, 401, { error: "نام کاربری یا رمز عبور نادرست است." });
      if (!account) return fail();
      if (!verifyPassword(password, account.salt, account.hash)) return fail();

      setSessionCookie(res, signSession(account.username));
      return send(res, 200, { ok: true, user: account.username });
    }

    if (action === "password") {
      // تغییر رمز عبور کاربر واردشده
      const user = currentUser(req);
      if (!user) return send(res, 401, { error: "ابتدا وارد شوید." });
      const next = String(body.newPassword || "");
      if (next.length < MIN_PASSWORD) {
        return send(res, 400, { error: `رمز عبور جدید باید حداقل ${MIN_PASSWORD} کاراکتر باشد.` });
      }
      const accounts = await loadAccounts();
      const account = accounts.find(a => a.username.toLowerCase() === user.toLowerCase());
      if (!account) return send(res, 401, { error: "حساب یافت نشد." });
      if (!verifyPassword(password, account.salt, account.hash)) {
        return send(res, 403, { error: "رمز عبور فعلی نادرست است." });
      }
      const { salt, hash } = hashPassword(next);
      account.salt = salt;
      account.hash = hash;
      await saveAccounts(accounts);
      // نشست را تازه می‌کنیم
      setSessionCookie(res, signSession(account.username));
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: "درخواست نامعتبر است." });
  } catch (err: any) {
    console.error("auth error:", err);
    return send(res, 500, { error: "خطای سرور در پردازش حساب کاربری." });
  }
}
