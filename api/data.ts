import { Req, Res, send, readBody, currentUser, loadUserData, saveUserData } from "./_lib/core.js";

/**
 * GET  /api/data  → وضعیت کامل حساب کاربر واردشده
 * POST /api/data  → ذخیره‌ی وضعیت کامل
 *
 * هر کاربر فقط به داده‌ی خودش دسترسی دارد؛ نام فایل از روی نام کاربری
 * نشست ساخته می‌شود، نه از ورودی درخواست.
 */
export default async function handler(req: Req, res: Res) {
  const user = currentUser(req);
  if (!user) return send(res, 401, { error: "ابتدا وارد شوید." });

  try {
    if (req.method === "GET") {
      const data = await loadUserData(user);
      return send(res, 200, data);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      if (!body || typeof body !== "object" || !body.settings) {
        return send(res, 400, { error: "ساختار داده نامعتبر است." });
      }
      await saveUserData(user, body);
      return send(res, 200, { success: true, data: body });
    }

    return send(res, 405, { error: "روش درخواست پشتیبانی نمی‌شود." });
  } catch (err: any) {
    console.error("data error:", err);
    return send(res, 500, { error: "خطای سرور در خواندن یا ذخیره‌ی اطلاعات." });
  }
}
