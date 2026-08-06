/**
 * هسته مشترک بک‌اند: ذخیره‌سازی + احراز هویت
 *
 * روی ورسل: داده‌ها در Vercel Blob ذخیره می‌شوند.
 * روی لوکال (بدون توکن Blob): داده‌ها در پوشه .data/ کنار پروژه ذخیره می‌شوند.
 *
 * همین فایل هم توسط توابع serverless در api/ و هم توسط server.ts (dev) استفاده می‌شود.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------- تنظیمات

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
export const USE_BLOB = BLOB_TOKEN.length > 0;

/** کلید امضای نشست. روی ورسل حتماً باید ست شود. */
const AUTH_SECRET =
  process.env.AUTH_SECRET || "insecure-local-dev-secret-do-not-use-in-production";

/** کد دعوت برای ساخت حساب جدید (اختیاری ولی توصیه‌شده). */
const SIGNUP_CODE = process.env.SIGNUP_CODE || "";

const IS_VERCEL = !!process.env.VERCEL;
const SESSION_COOKIE = "gold_session";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------- مسیرها
//
// نام فایل‌ها با HMAC از روی AUTH_SECRET ساخته می‌شود تا آدرس عمومی Blob
// بدون دانستن کلید قابل حدس زدن نباشد.

function scope(name: string): string {
  return crypto.createHmac("sha256", AUTH_SECRET).update(name).digest("hex").slice(0, 40);
}

const accountsPath = () => `gold/${scope("accounts")}.json`;
const userDataPath = (username: string) => `gold/${scope("data:" + username.toLowerCase())}.json`;

// ---------------------------------------------------------------- ذخیره‌سازی

const LOCAL_DIR = path.join(process.cwd(), ".data");

function localFile(pathname: string): string {
  const safe = pathname.replace(/[^a-zA-Z0-9._/-]/g, "_");
  return path.join(LOCAL_DIR, safe);
}

/**
 * آیا این خطا یعنی «چنین فایلی وجود ندارد»؟
 *
 * نبودِ فایل حالت عادی است (اولین اجرا، یا کاربری که هنوز داده‌ای ذخیره نکرده)
 * و باید null برگردد، نه خطا. پیام‌های SDK در نسخه‌های مختلف فرق می‌کنند
 * («not found»، «does not exist»، «missing») و گاهی name هم فقط Error است،
 * برای همین روی مجموعِ name و message تطبیق می‌دهیم.
 */
function isNotFound(err: any): boolean {
  const msg = `${err?.name ?? ""} ${err?.message ?? ""}`;
  return /BlobNotFound|not\s*found|does\s*not\s*exist|no\s*such|missing|404/i.test(msg);
}

async function blobRead<T>(pathname: string): Promise<T | null> {
  const { head } = await import("@vercel/blob");
  try {
    const meta = await head(pathname, { token: BLOB_TOKEN });
    // کش CDN را دور می‌زنیم تا همیشه آخرین نسخه خوانده شود
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err: any) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function blobWrite(pathname: string, data: unknown): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(pathname, JSON.stringify(data), {
    access: "public",
    token: BLOB_TOKEN,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export async function readJSON<T>(pathname: string): Promise<T | null> {
  if (USE_BLOB) return blobRead<T>(pathname);
  const file = localFile(pathname);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeJSON(pathname: string, data: unknown): Promise<void> {
  if (USE_BLOB) {
    await blobWrite(pathname, data);
    return;
  }
  const file = localFile(pathname);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ---------------------------------------------------------------- حساب‌ها

export interface Account {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

interface AccountsFile {
  accounts: Account[];
}

export async function loadAccounts(): Promise<Account[]> {
  const file = await readJSON<AccountsFile>(accountsPath());
  return file?.accounts ?? [];
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  await writeJSON(accountsPath(), { accounts });
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  let candidate: Buffer;
  try {
    candidate = crypto.scryptSync(password, salt, 64);
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------- نشست

export function signSession(username: string): string {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): string | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return u;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- HTTP کمکی

export interface Req {
  method?: string;
  body?: any;
  headers: Record<string, any>;
  on?: (ev: string, cb: (...a: any[]) => void) => void;
}

export interface Res {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
  end(chunk?: string): void;
}

export function send(res: Res, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function readCookie(req: Req, name: string): string | undefined {
  const raw = req.headers?.cookie;
  if (!raw || typeof raw !== "string") return undefined;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

function cookieFlags(maxAgeSeconds: number): string {
  const flags = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (IS_VERCEL) flags.push("Secure");
  return flags.join("; ");
}

export function setSessionCookie(res: Res, token: string): void {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; ${cookieFlags(SESSION_DAYS * 86400)}`);
}

export function clearSessionCookie(res: Res): void {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${cookieFlags(0)}`);
}

/** نام کاربری نشست معتبر، یا null */
export function currentUser(req: Req): string | null {
  return verifySession(readCookie(req, SESSION_COOKIE));
}

/**
 * بدنه‌ی JSON را برمی‌گرداند.
 * ورسل و express هر دو body را از قبل پارس می‌کنند؛ در غیر این صورت از stream می‌خوانیم.
 */
export async function readBody(req: Req): Promise<any> {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.on !== "function") return {};
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on!("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    req.on!("end", () => resolve());
    req.on!("error", (e: Error) => reject(e));
  });
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- داده کاربر

/** وضعیت اولیه‌ی یک حساب تازه‌ساخته‌شده */
export function defaultAppState() {
  return {
    settings: {
      shops: [],
      persons: [],
      coins: [
        { name: "سکه 86", weight: 9.756 },
        { name: "سکه پایین", weight: 9.756 },
        { name: "نیم سکه 86", weight: 4.8792 },
        { name: "نیم پایین", weight: 4.8792 },
        { name: "ربع سکه 86", weight: 2.44 },
        { name: "ربع پایین", weight: 2.44 },
      ],
      currentGoldPrice: 35000000,
      spreadsheetId: "",
    },
    transactions: [],
    sheets: [],
  };
}

export async function loadUserData(username: string): Promise<any> {
  const data = await readJSON<any>(userDataPath(username));
  return data ?? defaultAppState();
}

export async function saveUserData(username: string, data: unknown): Promise<void> {
  await writeJSON(userDataPath(username), data);
}

/**
 * داده‌های نسخه‌ی قدیمی برنامه (فایل data.json کنار پروژه) را می‌خواند.
 *
 * قبل از اضافه شدن حساب کاربری، همه‌ی داده‌ها در همین یک فایل بود. اولین
 * حسابی که ساخته می‌شود همین داده‌ها را تحویل می‌گیرد تا اسناد قبلی از بین
 * نروند. اگر فایل نبود یا خراب بود، بی‌صدا null برمی‌گردد.
 */
export function loadLegacyState(): any | null {
  const candidates = [
    path.join(process.cwd(), "data.json"),
    path.join(process.cwd(), "..", "data.json"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      // فقط اگر ساختارش معتبر و غیرخالی بود
      if (!parsed || typeof parsed !== "object") continue;
      if (!parsed.settings || !Array.isArray(parsed.transactions)) continue;
      const hasContent =
        parsed.transactions.length > 0 ||
        (parsed.settings.shops?.length ?? 0) > 0 ||
        (parsed.settings.persons?.length ?? 0) > 0;
      if (!hasContent) continue;
      return { ...parsed, sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [] };
    } catch {
      // فایل خراب — سراغ گزینه‌ی بعدی
    }
  }
  return null;
}

/**
 * وضعیت اولیه‌ی یک حساب تازه.
 * اولین حساب سیستم داده‌های قدیمی data.json را به ارث می‌برد (اگر وجود داشته باشد).
 */
export function initialStateForNewAccount(isFirstAccount: boolean): any {
  if (isFirstAccount) {
    const legacy = loadLegacyState();
    if (legacy) return legacy;
  }
  return defaultAppState();
}

// ---------------------------------------------------------------- ثبت‌نام

export interface SignupPolicy {
  /** آیا ساخت حساب در حال حاضر مجاز است */
  open: boolean;
  /** آیا کد دعوت لازم است */
  needsCode: boolean;
  reason?: string;
}

export function signupPolicy(accountCount: number): SignupPolicy {
  // اولین حساب همیشه آزاد است تا بشود سیستم را راه انداخت
  if (accountCount === 0) return { open: true, needsCode: false };
  if (SIGNUP_CODE) return { open: true, needsCode: true };
  return {
    open: false,
    needsCode: false,
    reason:
      "ساخت حساب جدید بسته است. برای فعال کردن آن، متغیر SIGNUP_CODE را در تنظیمات پروژه ورسل مقداردهی کنید.",
  };
}

export function checkSignupCode(code: string | undefined): boolean {
  if (!SIGNUP_CODE) return false;
  const a = Buffer.from(String(code || ""));
  const b = Buffer.from(SIGNUP_CODE);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const USERNAME_RE = /^[a-zA-Z0-9_.\-]{3,32}$/;
export const MIN_PASSWORD = 6;
