// ===================================================================
// موتور فرمول صفحه‌گسترده (شبیه اکسل)
// پشتیبانی از: + - * / ^ % & پرانتز، ارجاع سلول (A1)، محدوده (A1:B5)
// و توابع انگلیسی و فارسی (SUM / جمع ، AVERAGE / میانگین و ...)
// ===================================================================

export type CellValue = number | string | boolean;

export interface CellData {
  v: string;            // محتوای خام سلول (متن، عدد یا فرمول با = )
  b?: boolean;          // Bold
  bg?: string;          // رنگ پس‌زمینه
}

export type Cells = Record<string, CellData>;

export class FormulaError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

// ---------- تبدیل ایندکس ستون به حرف و برعکس ----------
export function colToName(idx: number): string {
  let s = "";
  let n = idx + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function nameToColIdx(name: string): number {
  let n = 0;
  const up = name.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    n = n * 26 + (up.charCodeAt(i) - 64);
  }
  return n - 1;
}

export const cellKey = (r: number, c: number) => colToName(c) + (r + 1);

export function parseRef(ref: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]{1,3})(\d{1,7})$/.exec(ref.replace(/\$/g, ""));
  if (!m) return null;
  return { c: nameToColIdx(m[1]), r: Number(m[2]) - 1 };
}

// ---------- اعداد ----------
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa > -1) { out += String(fa); continue; }
    const ar = AR_DIGITS.indexOf(ch);
    if (ar > -1) { out += String(ar); continue; }
    if (ch === "٫") { out += "."; continue; }
    if (ch === "٬") { out += ","; continue; }
    out += ch;
  }
  return out;
}

/** اگر متن یک عدد معتبر باشد مقدار عددی، وگرنه null */
export function parseNumeric(raw: string): number | null {
  let s = normalizeDigits(String(raw)).trim();
  if (!s) return null;
  let percent = false;
  if (s.endsWith("%")) { percent = true; s = s.slice(0, -1).trim(); }
  s = s.replace(/,/g, "").replace(/\s/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return percent ? n / 100 : n;
}

// ---------- محدوده ----------
/**
 * یک محدوده (آرایه) از مقادیر. مقادیر «سطرْمحور» ذخیره می‌شوند:
 * اندیس هر خانه = r * cols + c
 * داشتن rows و cols برای توابعی مثل FILTER لازم است که باید سطرها را
 * به‌صورت کامل نگه دارند یا حذف کنند.
 */
export class RangeValue {
  values: CellValue[];
  rows: number;
  cols: number;
  constructor(values: CellValue[], rows?: number, cols?: number) {
    this.values = values;
    this.cols = cols ?? 1;
    this.rows = rows ?? values.length;
  }
}

/** محدوده‌ی تک‌خانه‌ای را به مقدار ساده تبدیل می‌کند */
function unwrap(v: CellValue | RangeValue): CellValue | RangeValue {
  if (v instanceof RangeValue && v.values.length === 1) return v.values[0];
  return v;
}

/** هر مقدار را به شکل محدوده می‌بیند (برای توابع آرایه‌ای) */
function asRange(v: CellValue | RangeValue | undefined): RangeValue {
  if (v instanceof RangeValue) return v;
  return new RangeValue([v ?? ""], 1, 1);
}

/**
 * عملگرهای دوتایی را روی آرایه‌ها هم اعمال می‌کند (مثل اکسل مدرن):
 *   A1:A9*2      → آرایه‌ای هم‌اندازه
 *   C1:C9<>""    → آرایه‌ای از درست/غلط، ورودیِ FILTER
 * اگر هر دو طرف ساده باشند، نتیجه هم ساده است تا رفتار قبلی عوض نشود.
 */
function broadcast(
  l: CellValue | RangeValue,
  r: CellValue | RangeValue,
  fn: (a: CellValue, b: CellValue) => CellValue
): CellValue | RangeValue {
  const la = l instanceof RangeValue;
  const ra = r instanceof RangeValue;
  if (!la && !ra) return fn(l as CellValue, r as CellValue);

  if (la && ra) {
    const lv = l as RangeValue;
    const rv = r as RangeValue;
    const len = Math.min(lv.values.length, rv.values.length);
    const out: CellValue[] = [];
    for (let i = 0; i < len; i++) out.push(fn(lv.values[i], rv.values[i]));
    const sameShape = lv.rows === rv.rows && lv.cols === rv.cols;
    return unwrap(new RangeValue(out, sameShape ? lv.rows : len, sameShape ? lv.cols : 1));
  }

  const arr = (la ? l : r) as RangeValue;
  const scalar = (la ? r : l) as CellValue;
  const out = arr.values.map(v => (la ? fn(v, scalar) : fn(scalar, v)));
  return unwrap(new RangeValue(out, arr.rows, arr.cols));
}

/** عملگر یکانی روی آرایه یا مقدار ساده */
function mapValue(v: CellValue | RangeValue, fn: (a: CellValue) => CellValue): CellValue | RangeValue {
  if (v instanceof RangeValue) return unwrap(new RangeValue(v.values.map(fn), v.rows, v.cols));
  return fn(v);
}

// ---------- توکنایزر ----------
interface Token { t: string; v: string }

function tokenize(src: string): Token[] {
  const s = normalizeDigits(src);
  const out: Token[] = [];
  let i = 0;
  const isDigit = (ch: string) => ch >= "0" && ch <= "9";
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }

    if (isDigit(ch) || (ch === "." && isDigit(s[i + 1]))) {
      let j = i;
      while (j < s.length && (isDigit(s[j]) || s[j] === ".")) j++;
      out.push({ t: "num", v: s.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let str = "";
      while (j < s.length && s[j] !== '"') { str += s[j]; j++; }
      out.push({ t: "str", v: str });
      i = j + 1;
      continue;
    }

    // خطاهای ثابت داخل فرمول (مثل #REF! که بعد از حذف ستون/ردیف جایگزین می‌شود)
    if (ch === "#") {
      const m = /^#(DIV\/0!|VALUE!|NAME\?|REF!|NUM!|CIRC!|SPILL!|CALC!|ERROR!|N\/A)/i.exec(s.slice(i));
      if (!m) throw new FormulaError("#NAME?");
      out.push({ t: "err", v: m[0].toUpperCase() });
      i += m[0].length;
      continue;
    }

    // حروف فارسی/عربی از U+0620 شروع می‌شوند؛ محدوده U+0600..U+061F علائم نگارشی
    // (مثل «،» و «؛») است و نباید جزو نام تابع حساب شود.
    if (/[A-Za-z_$ؠ-ۿ]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_$ؠ-ۿ]/.test(s[j])) j++;
      out.push({ t: "ident", v: s.slice(i, j) });
      i = j;
      continue;
    }

    const two = s.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") { out.push({ t: "op", v: two }); i += 2; continue; }

    if (ch === "(") { out.push({ t: "lp", v: ch }); i++; continue; }
    if (ch === ")") { out.push({ t: "rp", v: ch }); i++; continue; }
    if (ch === "," || ch === ";" || ch === "،" || ch === "؛") { out.push({ t: "comma", v: "," }); i++; continue; }
    if (ch === ":") { out.push({ t: "colon", v: ":" }); i++; continue; }
    if ("+-*/^&%=<>".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }

    throw new FormulaError("#NAME?");
  }
  return out;
}

// ---------- تبدیل مقادیر ----------
function toNum(v: CellValue | RangeValue): number {
  if (v instanceof RangeValue) {
    if (v.values.length === 1) return toNum(v.values[0]);
    throw new FormulaError("#VALUE!");
  }
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    if (v.startsWith("#")) throw new FormulaError(v);
    if (v.trim() === "") return 0;
    const n = parseNumeric(v);
    if (n === null) throw new FormulaError("#VALUE!");
    return n;
  }
  return 0;
}

function toStr(v: CellValue | RangeValue): string {
  if (v instanceof RangeValue) throw new FormulaError("#VALUE!");
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && v.startsWith("#")) throw new FormulaError(v);
  return String(v ?? "");
}

function toBool(v: CellValue | RangeValue): boolean {
  if (v instanceof RangeValue) throw new FormulaError("#VALUE!");
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  if (s === "TRUE" || s === "درست" || s === "بله") return true;
  if (s === "FALSE" || s === "غلط" || s === "خیر" || s === "") return false;
  const n = parseNumeric(s);
  return n === null ? true : n !== 0;
}

/** همه آرگومان‌ها را صاف می‌کند (محدوده‌ها باز می‌شوند) */
function flatten(args: (CellValue | RangeValue)[]): CellValue[] {
  const out: CellValue[] = [];
  for (const a of args) {
    if (a instanceof RangeValue) out.push(...a.values);
    else out.push(a);
  }
  return out;
}

/** فقط اعداد؛ متن‌های داخل محدوده نادیده گرفته می‌شوند (مثل اکسل) */
function numbersOf(args: (CellValue | RangeValue)[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a instanceof RangeValue) {
      for (const v of a.values) {
        if (typeof v === "string" && v.startsWith("#")) throw new FormulaError(v);
        if (typeof v === "number") out.push(v);
        else if (typeof v === "boolean") continue;
        else if (typeof v === "string" && v.trim() !== "") {
          const n = parseNumeric(v);
          if (n !== null) out.push(n);
        }
      }
    } else {
      if (typeof a === "string" && a.trim() === "") continue;
      out.push(toNum(a));
    }
  }
  return out;
}

// ---------- توابع ----------
type FnArgs = (CellValue | RangeValue)[];

const FUNCTIONS: Record<string, (args: FnArgs) => CellValue | RangeValue> = {
  SUM: a => numbersOf(a).reduce((x, y) => x + y, 0),
  PRODUCT: a => { const n = numbersOf(a); return n.length ? n.reduce((x, y) => x * y, 1) : 0; },
  AVERAGE: a => { const n = numbersOf(a); if (!n.length) throw new FormulaError("#DIV/0!"); return n.reduce((x, y) => x + y, 0) / n.length; },
  MIN: a => { const n = numbersOf(a); return n.length ? Math.min(...n) : 0; },
  MAX: a => { const n = numbersOf(a); return n.length ? Math.max(...n) : 0; },
  COUNT: a => numbersOf(a).length,
  COUNTA: a => flatten(a).filter(v => !(typeof v === "string" && v.trim() === "")).length,
  ABS: a => Math.abs(toNum(a[0])),
  INT: a => Math.floor(toNum(a[0])),
  SQRT: a => { const n = toNum(a[0]); if (n < 0) throw new FormulaError("#NUM!"); return Math.sqrt(n); },
  POWER: a => Math.pow(toNum(a[0]), toNum(a[1])),
  MOD: a => { const d = toNum(a[1]); if (d === 0) throw new FormulaError("#DIV/0!"); return toNum(a[0]) % d; },
  ROUND: a => { const d = a.length > 1 ? toNum(a[1]) : 0; const p = Math.pow(10, d); return Math.round(toNum(a[0]) * p) / p; },
  ROUNDUP: a => { const d = a.length > 1 ? toNum(a[1]) : 0; const p = Math.pow(10, d); return Math.ceil(toNum(a[0]) * p) / p; },
  ROUNDDOWN: a => { const d = a.length > 1 ? toNum(a[1]) : 0; const p = Math.pow(10, d); return Math.floor(toNum(a[0]) * p) / p; },
  IF: a => (toBool(a[0]) ? (a[1] instanceof RangeValue ? toNum(a[1]) : (a[1] ?? "")) : (a.length > 2 ? (a[2] instanceof RangeValue ? toNum(a[2]) : a[2]) : false)) as CellValue,
  AND: a => flatten(a).every(v => toBool(v)),
  OR: a => flatten(a).some(v => toBool(v)),
  NOT: a => !toBool(a[0]),
  CONCAT: a => flatten(a).map(v => toStr(v)).join(""),
  CONCATENATE: a => flatten(a).map(v => toStr(v)).join(""),
  LEN: a => toStr(a[0]).length,
  TRIM: a => toStr(a[0]).trim(),
  UPPER: a => toStr(a[0]).toUpperCase(),
  LOWER: a => toStr(a[0]).toLowerCase(),
  PERCENT: a => toNum(a[0]) * toNum(a[1]) / 100,
  SUMIF: a => {
    const range = a[0] instanceof RangeValue ? (a[0] as RangeValue).values : [a[0] as CellValue];
    const crit = a[1];
    const sumRange = a.length > 2 && a[2] instanceof RangeValue ? (a[2] as RangeValue).values : range;
    let total = 0;
    range.forEach((v, i) => {
      if (matchCriteria(v, crit as CellValue)) {
        const target = sumRange[i];
        if (typeof target === "number") total += target;
        else if (typeof target === "string") { const n = parseNumeric(target); if (n !== null) total += n; }
      }
    });
    return total;
  },
  COUNTIF: a => {
    const range = a[0] instanceof RangeValue ? (a[0] as RangeValue).values : [a[0] as CellValue];
    const crit = a[1];
    return range.filter(v => matchCriteria(v, crit as CellValue)).length;
  },

  // ---------- توابع آرایه‌ای (نتیجه در ستون/ردیف سرریز می‌شود) ----------

  /**
   * FILTER(محدوده؛ شرط؛ [اگر خالی بود])
   * فقط سطرهایی از محدوده را برمی‌گرداند که شرط برایشان درست است.
   * مثال: =FILTER(C:C؛ C:C<>"")  → ستون C بدون خانه‌های خالی
   */
  FILTER: a => {
    if (a.length < 2) throw new FormulaError("#VALUE!");
    const arr = asRange(a[0]);
    const mask = asRange(a[1]).values;
    const ifEmpty = a.length > 2 ? a[2] : undefined;

    // شرط باید به تعداد سطرهای محدوده مقدار داشته باشد
    if (mask.length !== arr.rows && mask.length !== 1) throw new FormulaError("#VALUE!");

    const out: CellValue[] = [];
    let kept = 0;
    for (let r = 0; r < arr.rows; r++) {
      const flag = mask.length === 1 ? mask[0] : mask[r];
      if (!toBool(flag)) continue;
      kept++;
      for (let c = 0; c < arr.cols; c++) out.push(arr.values[r * arr.cols + c]);
    }
    if (!kept) {
      if (ifEmpty === undefined) throw new FormulaError("#CALC!");
      return ifEmpty;
    }
    return unwrap(new RangeValue(out, kept, arr.cols));
  },

  /** UNIQUE(محدوده) — سطرهای تکراری را حذف می‌کند */
  UNIQUE: a => {
    const arr = asRange(a[0]);
    const seen = new Set<string>();
    const out: CellValue[] = [];
    let kept = 0;
    for (let r = 0; r < arr.rows; r++) {
      const row = arr.values.slice(r * arr.cols, (r + 1) * arr.cols);
      const key = row.map(v => String(v)).join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      kept++;
      out.push(...row);
    }
    return unwrap(new RangeValue(out, kept, arr.cols));
  },

  /** SORT(محدوده؛ [شماره ستون]؛ [1 صعودی / -1 نزولی]) */
  SORT: a => {
    const arr = asRange(a[0]);
    const byCol = a.length > 1 ? Math.max(1, Math.trunc(toNum(a[1] as CellValue))) - 1 : 0;
    const dir = a.length > 2 && toNum(a[2] as CellValue) < 0 ? -1 : 1;
    if (byCol >= arr.cols) throw new FormulaError("#VALUE!");

    const rows: CellValue[][] = [];
    for (let r = 0; r < arr.rows; r++) rows.push(arr.values.slice(r * arr.cols, (r + 1) * arr.cols));
    rows.sort((x, y) => {
      const xv = x[byCol], yv = y[byCol];
      const xn = typeof xv === "number" ? xv : parseNumeric(String(xv));
      const yn = typeof yv === "number" ? yv : parseNumeric(String(yv));
      if (xn !== null && yn !== null) return (xn - yn) * dir;
      return String(xv).localeCompare(String(yv), "fa") * dir;
    });
    return unwrap(new RangeValue(rows.flat(), arr.rows, arr.cols));
  },

  /** TRANSPOSE(محدوده) — سطر و ستون را جابجا می‌کند */
  TRANSPOSE: a => {
    const arr = asRange(a[0]);
    const out: CellValue[] = [];
    for (let c = 0; c < arr.cols; c++) {
      for (let r = 0; r < arr.rows; r++) out.push(arr.values[r * arr.cols + c]);
    }
    return unwrap(new RangeValue(out, arr.cols, arr.rows));
  }
};

function matchCriteria(value: CellValue, criteria: CellValue): boolean {
  if (typeof criteria === "string") {
    const m = /^(>=|<=|<>|>|<|=)(.*)$/.exec(criteria.trim());
    if (m) {
      const opr = m[1];
      const rhsRaw = m[2].trim();
      const rhsNum = parseNumeric(rhsRaw);
      if (rhsNum !== null && typeof value !== "string") {
        const lv = typeof value === "number" ? value : (value ? 1 : 0);
        switch (opr) {
          case ">": return lv > rhsNum;
          case "<": return lv < rhsNum;
          case ">=": return lv >= rhsNum;
          case "<=": return lv <= rhsNum;
          case "<>": return lv !== rhsNum;
          default: return lv === rhsNum;
        }
      }
      if (rhsNum !== null && typeof value === "string") {
        const lv = parseNumeric(value);
        if (lv === null) return false;
        switch (opr) {
          case ">": return lv > rhsNum;
          case "<": return lv < rhsNum;
          case ">=": return lv >= rhsNum;
          case "<=": return lv <= rhsNum;
          case "<>": return lv !== rhsNum;
          default: return lv === rhsNum;
        }
      }
      const lvs = String(value);
      return opr === "<>" ? lvs !== rhsRaw : lvs === rhsRaw;
    }
  }
  if (typeof criteria === "number") {
    const lv = typeof value === "number" ? value : parseNumeric(String(value));
    return lv === criteria;
  }
  return String(value) === String(criteria);
}

// معادل‌های فارسی توابع
const FA_ALIASES: Record<string, string> = {
  "جمع": "SUM",
  "مجموع": "SUM",
  "میانگین": "AVERAGE",
  "متوسط": "AVERAGE",
  "کمترین": "MIN",
  "حداقل": "MIN",
  "بیشترین": "MAX",
  "حداکثر": "MAX",
  "تعداد": "COUNT",
  "شمارش": "COUNTA",
  "ضرب": "PRODUCT",
  "حاصلضرب": "PRODUCT",
  "قدرمطلق": "ABS",
  "گردکردن": "ROUND",
  "گرد": "ROUND",
  "جذر": "SQRT",
  "توان": "POWER",
  "باقیمانده": "MOD",
  "اگر": "IF",
  "و": "AND",
  "یا": "OR",
  "چسباندن": "CONCAT",
  "طول": "LEN",
  "درصد": "PERCENT",
  "جمعاگر": "SUMIF",
  "تعداداگر": "COUNTIF",
  "فیلتر": "FILTER",
  "پالایش": "FILTER",
  "یکتا": "UNIQUE",
  "بیتکرار": "UNIQUE",
  "مرتب": "SORT",
  "چیدن": "SORT",
  "ترانهاده": "TRANSPOSE"
};

export const FUNCTION_NAMES = [
  ...Object.keys(FUNCTIONS),
  ...Object.keys(FA_ALIASES)
];

function resolveFn(name: string) {
  const up = name.toUpperCase();
  if (FUNCTIONS[up]) return FUNCTIONS[up];
  const alias = FA_ALIASES[name] || FA_ALIASES[name.trim()];
  if (alias && FUNCTIONS[alias]) return FUNCTIONS[alias];
  return null;
}

// ---------- پارسر ----------
interface Resolver {
  ref: (ref: string) => CellValue;
  range: (a: string, b: string) => RangeValue;
  /** ارجاع به کل ستون‌ها مثل C:C */
  colRange: (c1: number, c2: number) => RangeValue;
  /** ارجاع به کل ردیف‌ها مثل 2:2 */
  rowRange: (r1: number, r2: number) => RangeValue;
}

/** فقط حرف (بدون شماره) → نام ستون در ارجاع C:C */
const COL_ONLY = /^[A-Za-z]{1,3}$/;

class Parser {
  toks: Token[];
  i = 0;
  res: Resolver;
  constructor(toks: Token[], res: Resolver) { this.toks = toks; this.res = res; }

  peek(): Token | undefined { return this.toks[this.i]; }
  next(): Token | undefined { return this.toks[this.i++]; }
  expect(t: string) {
    const tok = this.next();
    if (!tok || tok.t !== t) throw new FormulaError("#ERROR!");
    return tok;
  }

  parse(): CellValue | RangeValue {
    const v = this.parseCompare();
    if (this.i < this.toks.length) throw new FormulaError("#ERROR!");
    return v;
  }

  parseCompare(): CellValue | RangeValue {
    let left = this.parseConcat();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && ["=", "<>", ">", "<", ">=", "<="].includes(t.v)) {
        this.next();
        const right = this.parseConcat();
        left = broadcast(left, right, (a, b) => {
          const bothNum = typeof a === "number" && typeof b === "number";
          const lv: any = bothNum ? a : toStr(a);
          const rv: any = bothNum ? b : toStr(b);
          switch (t.v) {
            case "=": return lv === rv;
            case "<>": return lv !== rv;
            case ">": return lv > rv;
            case "<": return lv < rv;
            case ">=": return lv >= rv;
            default: return lv <= rv;
          }
        });
      } else break;
    }
    return left;
  }

  parseConcat(): CellValue | RangeValue {
    let left = this.parseAdd();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && t.v === "&") {
        this.next();
        const right = this.parseAdd();
        left = broadcast(left, right, (a, b) => toStr(a) + toStr(b));
      } else break;
    }
    return left;
  }

  parseAdd(): CellValue | RangeValue {
    let left = this.parseMul();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
        this.next();
        const right = this.parseMul();
        left = broadcast(left, right, (a, b) =>
          t.v === "+" ? toNum(a) + toNum(b) : toNum(a) - toNum(b)
        );
      } else break;
    }
    return left;
  }

  parseMul(): CellValue | RangeValue {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/")) {
        this.next();
        const right = this.parseUnary();
        left = broadcast(left, right, (a, b) => {
          if (t.v === "*") return toNum(a) * toNum(b);
          const d = toNum(b);
          if (d === 0) throw new FormulaError("#DIV/0!");
          return toNum(a) / d;
        });
      } else break;
    }
    return left;
  }

  parseUnary(): CellValue | RangeValue {
    const t = this.peek();
    if (t && t.t === "op" && (t.v === "-" || t.v === "+")) {
      this.next();
      const v = this.parseUnary();
      return mapValue(v, a => (t.v === "-" ? -toNum(a) : toNum(a)));
    }
    return this.parsePower();
  }

  parsePower(): CellValue | RangeValue {
    let base = this.parsePostfix();
    const t = this.peek();
    if (t && t.t === "op" && t.v === "^") {
      this.next();
      const exp = this.parseUnary();
      base = broadcast(base, exp, (a, b) => Math.pow(toNum(a), toNum(b)));
    }
    return base;
  }

  parsePostfix(): CellValue | RangeValue {
    let v = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && t.v === "%") { this.next(); v = mapValue(v, a => toNum(a) / 100); }
      else break;
    }
    return v;
  }

  parsePrimary(): CellValue | RangeValue {
    const t = this.next();
    if (!t) throw new FormulaError("#ERROR!");

    if (t.t === "num") {
      // ارجاع به کل ردیف‌ها: 2:2 یا 2:5
      const nxt = this.peek();
      const after = this.toks[this.i + 1];
      if (nxt && nxt.t === "colon" && after && after.t === "num" &&
          /^\d+$/.test(t.v) && /^\d+$/.test(after.v)) {
        this.next();
        this.next();
        return this.res.rowRange(Number(t.v) - 1, Number(after.v) - 1);
      }
      return Number(t.v);
    }
    if (t.t === "str") return t.v;
    if (t.t === "err") throw new FormulaError(t.v);

    if (t.t === "lp") {
      const v = this.parseCompare();
      this.expect("rp");
      return v;
    }

    if (t.t === "ident") {
      const nxt = this.peek();

      // فراخوانی تابع
      if (nxt && nxt.t === "lp") {
        this.next();
        const fn = resolveFn(t.v);
        if (!fn) throw new FormulaError("#NAME?");
        const args: FnArgs = [];
        if (this.peek() && this.peek()!.t !== "rp") {
          args.push(this.parseCompare());
          while (this.peek() && this.peek()!.t === "comma") {
            this.next();
            args.push(this.parseCompare());
          }
        }
        this.expect("rp");
        return fn(args);
      }

      const bare = t.v.replace(/\$/g, "").toUpperCase();

      // ارجاع به کل ستون‌ها: C:C یا A:D
      if (nxt && nxt.t === "colon" && COL_ONLY.test(bare)) {
        const after = this.toks[this.i + 1];
        if (after && after.t === "ident") {
          const endCol = after.v.replace(/\$/g, "").toUpperCase();
          if (COL_ONLY.test(endCol)) {
            this.next();
            this.next();
            return this.res.colRange(nameToColIdx(bare), nameToColIdx(endCol));
          }
        }
      }

      // محدوده A1:B5
      if (nxt && nxt.t === "colon" && parseRef(bare)) {
        this.next();
        const end = this.next();
        if (!end || end.t !== "ident") throw new FormulaError("#REF!");
        const endRef = end.v.replace(/\$/g, "").toUpperCase();
        if (!parseRef(endRef)) throw new FormulaError("#REF!");
        return this.res.range(bare, endRef);
      }

      if (bare === "TRUE" || bare === "درست") return true;
      if (bare === "FALSE" || bare === "غلط") return false;

      if (parseRef(bare)) return this.res.ref(bare);

      throw new FormulaError("#NAME?");
    }

    throw new FormulaError("#ERROR!");
  }
}

// ---------- موتور ارزیابی ----------
export interface Engine {
  value: (ref: string) => CellValue;
  display: (ref: string) => string;
  /** اگر این خانه نتیجه‌ی سرریزِ فرمولِ خانه‌ی دیگری باشد، ارجاع آن خانه */
  spilledFrom: (ref: string) => string | null;
}

const MAX_RANGE_CELLS = 200000;
/** سقف تعداد خانه‌هایی که یک فرمول آرایه‌ای می‌تواند پر کند */
const MAX_SPILL_CELLS = 5000;

export function createEngine(cells: Cells): Engine {
  const cache = new Map<string, CellValue>();
  const arrays = new Map<string, RangeValue>();
  const stack = new Set<string>();

  /** نتیجه‌ی سرریزِ فرمول‌های آرایه‌ای: خانه‌ی مقصد → مقدار */
  let spill = new Map<string, CellValue>();
  /** خانه‌ی مقصد → خانه‌ی فرمول‌دار */
  let spillOwner = new Map<string, string>();
  /** فرمول‌هایی که جای کافی برای سرریز ندارند */
  let blocked = new Set<string>();

  // محدوده‌ی پرشده‌ی برگه: ارجاع C:C نباید کل ۲۰۰۰ ردیف را بخواند،
  // فقط تا آخرین ردیفی که واقعاً داده دارد.
  let usedRow = 0;
  let usedCol = 0;
  for (const k of Object.keys(cells)) {
    if ((cells[k]?.v ?? "") === "") continue;
    const p = parseRef(k);
    if (!p) continue;
    if (p.r > usedRow) usedRow = p.r;
    if (p.c > usedCol) usedCol = p.c;
  }

  const getValue = (refRaw: string): CellValue => {
    const ref = refRaw.replace(/\$/g, "").toUpperCase();
    if (cache.has(ref)) return cache.get(ref)!;
    if (stack.has(ref)) throw new FormulaError("#CIRC!");

    const raw = cells[ref]?.v ?? "";
    let val: CellValue;

    if (raw === "" || raw == null) {
      // خانه‌ی خالی ممکن است مقصدِ سرریزِ یک فرمول آرایه‌ای باشد
      val = spill.has(ref) ? spill.get(ref)! : "";
    } else if (raw.trim().startsWith("=")) {
      stack.add(ref);
      try {
        const toks = tokenize(raw.trim().slice(1));
        if (!toks.length) val = "";
        else {
          const parser = new Parser(toks, { ref: getValue, range: getRange, colRange, rowRange });
          const out = parser.parse();
          if (out instanceof RangeValue) {
            // نتیجه آرایه است: خودِ خانه اولین مقدار را نشان می‌دهد و
            // بقیه در خانه‌های پایین‌تر سرریز می‌شود.
            arrays.set(ref, out);
            val = out.values.length ? out.values[0] : "";
          } else {
            val = out;
          }
        }
      } catch (e) {
        val = e instanceof FormulaError ? e.code : "#ERROR!";
      } finally {
        stack.delete(ref);
      }
    } else {
      const n = parseNumeric(raw);
      val = n === null ? raw : n;
    }

    cache.set(ref, val);
    return val;
  };

  const buildRange = (r1: number, r2: number, c1: number, c2: number): RangeValue => {
    if (r1 < 0 || c1 < 0) throw new FormulaError("#REF!");
    const rows = r2 - r1 + 1;
    const cols = c2 - c1 + 1;
    if (rows * cols > MAX_RANGE_CELLS) throw new FormulaError("#REF!");
    const values: CellValue[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) values.push(getValue(cellKey(r, c)));
    }
    return new RangeValue(values, rows, cols);
  };

  const getRange = (a: string, b: string): RangeValue => {
    const pa = parseRef(a);
    const pb = parseRef(b);
    if (!pa || !pb) throw new FormulaError("#REF!");
    return buildRange(
      Math.min(pa.r, pb.r), Math.max(pa.r, pb.r),
      Math.min(pa.c, pb.c), Math.max(pa.c, pb.c)
    );
  };

  const colRange = (a: number, b: number): RangeValue =>
    buildRange(0, usedRow, Math.min(a, b), Math.max(a, b));

  const rowRange = (a: number, b: number): RangeValue =>
    buildRange(Math.min(a, b), Math.max(a, b), 0, usedCol);

  // ---------- گراف وابستگی و ترتیب محاسبه ----------
  // ارزیابی به‌صورت «درخواستی» است، پس ترتیبِ درستِ محاسبه خودبه‌خود رعایت
  // می‌شود؛ اما در زنجیره‌ی بلند (مثل D3=D2+C3 که تا D2000 پر شده) بازگشتِ
  // تودرتو پشته‌ی جاوااسکریپت را سرریز می‌کرد و همه‌ی خانه‌ها #ERROR! می‌شدند.
  // این بخش وابستگی‌ها را از پیش می‌سازد و خانه‌ها را به ترتیب توپولوژیک
  // (وابسته‌ها بعد از وابستگی‌ها) گرم می‌کند تا عمق بازگشت همیشه کم بماند.
  const MAX_DEP_WORK = 400000;

  /** فقط خانه‌های فرمول‌دار گره‌ی گراف‌اند؛ ارجاع به مقدار ثابت ترتیب‌ساز نیست */
  const formulaCells = new Set<string>();
  for (const k of Object.keys(cells)) {
    const key = k.replace(/\$/g, "").toUpperCase();
    if ((cells[k]?.v ?? "").trim().startsWith("=") && parseRef(key)) formulaCells.add(key);
  }

  const buildDepGraph = (): Map<string, string[]> | null => {
    const graph = new Map<string, string[]>();
    let budget = MAX_DEP_WORK;

    const addRect = (r1: number, r2: number, c1: number, c2: number, out: Set<string>): boolean => {
      if (r1 < 0 || c1 < 0) return true;
      const area = (r2 - r1 + 1) * (c2 - c1 + 1);
      if (area < 0 || area > budget) return false;
      budget -= area;
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const k = cellKey(r, c);
          if (formulaCells.has(k)) out.add(k);
        }
      }
      return true;
    };

    for (const ref of formulaCells) {
      const out = new Set<string>();
      let toks: Token[];
      try {
        toks = tokenize((cells[ref]?.v ?? "").trim().slice(1));
      } catch {
        graph.set(ref, []);          // فرمول خراب: خطایش موقع ارزیابی داده می‌شود
        continue;
      }
      if ((budget -= toks.length) < 0) return null;

      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        const nxt = toks[i + 1];
        const after = toks[i + 2];

        // ارجاع به کل ردیف‌ها: 2:2 یا 2:5
        if (t.t === "num") {
          if (nxt && nxt.t === "colon" && after && after.t === "num" &&
              /^\d+$/.test(t.v) && /^\d+$/.test(after.v)) {
            if (!addRect(Number(t.v) - 1, Number(after.v) - 1, 0, usedCol, out)) return null;
            i += 2;
          }
          continue;
        }

        if (t.t !== "ident") continue;
        if (nxt && nxt.t === "lp") continue;         // نام تابع، نه ارجاع

        const bare = t.v.replace(/\$/g, "").toUpperCase();

        if (nxt && nxt.t === "colon" && after && after.t === "ident") {
          const end = after.v.replace(/\$/g, "").toUpperCase();
          if (COL_ONLY.test(bare) && COL_ONLY.test(end)) {
            const ca = nameToColIdx(bare), cb = nameToColIdx(end);
            if (!addRect(0, usedRow, Math.min(ca, cb), Math.max(ca, cb), out)) return null;
            i += 2;
            continue;
          }
          const pa = parseRef(bare), pb = parseRef(end);
          if (pa && pb) {
            if (!addRect(
              Math.min(pa.r, pb.r), Math.max(pa.r, pb.r),
              Math.min(pa.c, pb.c), Math.max(pa.c, pb.c), out
            )) return null;
            i += 2;
            continue;
          }
        }

        if (formulaCells.has(bare) && parseRef(bare)) out.add(bare);
      }
      graph.set(ref, [...out]);
    }
    return graph;
  };

  /**
   * مؤلفه‌های قویاً همبند (الگوریتم تارجان، پیاده‌سازی حلقه‌ای نه بازگشتی).
   * خروجی به ترتیب «وابستگی‌ها اول» است و هر مؤلفه‌ی بزرگ‌تر از یک خانه
   * (یا خانه‌ای که به خودش ارجاع می‌دهد) یعنی حلقه‌ی دوری.
   */
  const buildOrder = (): { scc: string[]; cyclic: boolean }[] | null => {
    const graph = buildDepGraph();
    if (!graph) return null;

    const idx = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const st: string[] = [];
    const out: { scc: string[]; cyclic: boolean }[] = [];
    let counter = 0;

    for (const root of graph.keys()) {
      if (idx.has(root)) continue;
      idx.set(root, counter); low.set(root, counter); counter++;
      st.push(root); onStack.add(root);
      const work: { v: string; i: number }[] = [{ v: root, i: 0 }];

      while (work.length) {
        const frame = work[work.length - 1];
        const edges = graph.get(frame.v) ?? [];
        if (frame.i < edges.length) {
          const w = edges[frame.i++];
          if (!idx.has(w)) {
            idx.set(w, counter); low.set(w, counter); counter++;
            st.push(w); onStack.add(w);
            work.push({ v: w, i: 0 });
          } else if (onStack.has(w)) {
            low.set(frame.v, Math.min(low.get(frame.v)!, idx.get(w)!));
          }
        } else {
          if (low.get(frame.v) === idx.get(frame.v)) {
            const comp: string[] = [];
            for (;;) {
              const w = st.pop()!;
              onStack.delete(w);
              comp.push(w);
              if (w === frame.v) break;
            }
            const selfLoop = comp.length === 1 && (graph.get(comp[0]) ?? []).includes(comp[0]);
            out.push({ scc: comp, cyclic: comp.length > 1 || selfLoop });
          }
          work.pop();
          if (work.length) {
            const p = work[work.length - 1];
            low.set(p.v, Math.min(low.get(p.v)!, low.get(frame.v)!));
          }
        }
      }
    }
    return out;
  };

  // گراف فقط به cells بستگی دارد، پس یک‌بار ساخته می‌شود؛ ولی چون cache در هر
  // دورِ سرریز پاک می‌شود، گرم‌کردن باید دوباره انجام شود.
  let order: { scc: string[]; cyclic: boolean }[] | null | undefined;

  const warmUp = () => {
    if (order === undefined) order = buildOrder();
    if (!order) return;              // گراف بیش از حد بزرگ: همان مسیر تنبلِ قبلی
    for (const g of order) {
      if (g.cyclic) {
        for (const k of g.scc) cache.set(k, "#CIRC!");
      } else if (!cache.has(g.scc[0])) {
        getValue(g.scc[0]);
      }
    }
  };

  /**
   * فرمول‌های آرایه‌ای را پیدا می‌کند و مقصدِ سرریزشان را می‌سازد.
   * اگر خانه‌ی مقصد پر باشد، آن فرمول #SPILL! می‌گیرد (مثل اکسل).
   */
  const computeSpills = () => {
    const nextSpill = new Map<string, CellValue>();
    const nextOwner = new Map<string, string>();
    const nextBlocked = new Set<string>();

    // زنجیره‌ها را به ترتیب توپولوژیک گرم کن تا ارزیابی هیچ‌وقت عمیق نشود
    warmUp();

    const anchors = Object.keys(cells)
      .filter(k => (cells[k]?.v ?? "").trim().startsWith("=") && parseRef(k))
      .sort((x, y) => {
        const px = parseRef(x)!, py = parseRef(y)!;
        return px.r - py.r || px.c - py.c;
      });

    for (const ref of anchors) {
      const base = parseRef(ref)!;
      getValue(ref);                       // تا arrays پر شود
      const arr = arrays.get(ref);
      if (!arr || arr.values.length <= 1) continue;
      if (arr.values.length > MAX_SPILL_CELLS) { nextBlocked.add(ref); continue; }

      const pending: { k: string; v: CellValue }[] = [];
      let conflict = false;
      for (let i = 0; i < arr.values.length; i++) {
        const r = base.r + Math.floor(i / arr.cols);
        const c = base.c + (i % arr.cols);
        const k = cellKey(r, c);
        if (k === ref) continue;                       // خودِ خانه‌ی فرمول
        if ((cells[k]?.v ?? "") !== "" || nextSpill.has(k)) { conflict = true; break; }
        pending.push({ k, v: arr.values[i] });
      }
      if (conflict) { nextBlocked.add(ref); continue; }
      for (const p of pending) {
        nextSpill.set(p.k, p.v);
        nextOwner.set(p.k, ref);
      }
    }
    return { nextSpill, nextOwner, nextBlocked };
  };

  // چند دور تکرار تا وضعیت سرریز ثابت شود (فرمولی که به خانه‌ی سرریزشده
  // ارجاع می‌دهد در دور بعد مقدار درست را می‌بیند).
  for (let pass = 0; pass < 3; pass++) {
    const res = computeSpills();
    const stable =
      res.nextSpill.size === spill.size &&
      [...res.nextSpill.keys()].every(k => spill.has(k));
    spill = res.nextSpill;
    spillOwner = res.nextOwner;
    blocked = res.nextBlocked;
    cache.clear();
    arrays.clear();
    if (stable) break;
  }

  const publicValue = (refRaw: string): CellValue => {
    const ref = refRaw.replace(/\$/g, "").toUpperCase();
    if (blocked.has(ref)) return "#SPILL!";
    if (!cache.has(ref)) warmUp();
    return getValue(ref);
  };

  const display = (ref: string): string => {
    const v = publicValue(ref);
    if (v === "" || v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "درست" : "غلط";
    if (typeof v === "number") return formatNumber(v);
    return String(v);
  };

  const spilledFrom = (refRaw: string): string | null => {
    const ref = refRaw.replace(/\$/g, "").toUpperCase();
    return spillOwner.get(ref) ?? null;
  };

  return { value: publicValue, display, spilledFrom };
}

/** نمایش عدد با جداکننده هزارگان و حداکثر ۶ رقم اعشار */
export function formatNumber(n: number): string {
  if (!isFinite(n)) return "#NUM!";
  const rounded = Math.abs(n) < 1e15 ? Math.round(n * 1e6) / 1e6 : n;
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const [intPart, decPart] = String(abs).split(".");
  if (intPart.includes("e") || intPart.includes("E")) return String(rounded);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (decPart ? "." + decPart : "");
}

// ---------- جابجایی ارجاع‌ها (کپی/پیست و درج ردیف و ستون) ----------
const REF_RE = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/g;

/** ارجاع‌های نسبی فرمول را به اندازه dr و dc جابجا می‌کند */
export function shiftFormula(src: string, dr: number, dc: number): string {
  if (!src.trim().startsWith("=")) return src;
  return "=" + src.trim().slice(1).replace(REF_RE, (m, d1, col, d2, row) => {
    const c = d1 ? nameToColIdx(col) : nameToColIdx(col) + dc;
    const r = d2 ? Number(row) - 1 : Number(row) - 1 + dr;
    if (c < 0 || r < 0) return "#REF!";
    return `${d1}${colToName(c)}${d2}${r + 1}`;
  });
}

/** ارجاع‌های فرمول را با تابع نگاشت بازنویسی می‌کند (برای درج/حذف ردیف و ستون) */
export function remapFormula(src: string, map: (r: number, c: number) => { r: number; c: number } | null): string {
  if (!src.trim().startsWith("=")) return src;
  return "=" + src.trim().slice(1).replace(REF_RE, (m, d1, col, d2, row) => {
    const res = map(Number(row) - 1, nameToColIdx(col));
    if (!res) return "#REF!";
    return `${d1}${colToName(res.c)}${d2}${res.r + 1}`;
  });
}
