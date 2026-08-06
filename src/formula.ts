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
export class RangeValue {
  values: CellValue[];
  constructor(values: CellValue[]) { this.values = values; }
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
      const m = /^#(DIV\/0!|VALUE!|NAME\?|REF!|NUM!|CIRC!|ERROR!|N\/A)/i.exec(s.slice(i));
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

const FUNCTIONS: Record<string, (args: FnArgs) => CellValue> = {
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
  "تعداداگر": "COUNTIF"
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
}

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
        const l = left instanceof RangeValue ? toNum(left) : left;
        const r = right instanceof RangeValue ? toNum(right) : right;
        const bothNum = typeof l === "number" && typeof r === "number";
        const lv: any = bothNum ? l : toStr(l as CellValue);
        const rv: any = bothNum ? r : toStr(r as CellValue);
        switch (t.v) {
          case "=": left = lv === rv; break;
          case "<>": left = lv !== rv; break;
          case ">": left = lv > rv; break;
          case "<": left = lv < rv; break;
          case ">=": left = lv >= rv; break;
          case "<=": left = lv <= rv; break;
        }
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
        left = toStr(left) + toStr(right);
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
        left = t.v === "+" ? toNum(left) + toNum(right) : toNum(left) - toNum(right);
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
        if (t.v === "*") left = toNum(left) * toNum(right);
        else {
          const d = toNum(right);
          if (d === 0) throw new FormulaError("#DIV/0!");
          left = toNum(left) / d;
        }
      } else break;
    }
    return left;
  }

  parseUnary(): CellValue | RangeValue {
    const t = this.peek();
    if (t && t.t === "op" && (t.v === "-" || t.v === "+")) {
      this.next();
      const v = this.parseUnary();
      return t.v === "-" ? -toNum(v) : toNum(v);
    }
    return this.parsePower();
  }

  parsePower(): CellValue | RangeValue {
    let base = this.parsePostfix();
    const t = this.peek();
    if (t && t.t === "op" && t.v === "^") {
      this.next();
      const exp = this.parseUnary();
      base = Math.pow(toNum(base), toNum(exp));
    }
    return base;
  }

  parsePostfix(): CellValue | RangeValue {
    let v = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (t && t.t === "op" && t.v === "%") { this.next(); v = toNum(v) / 100; }
      else break;
    }
    return v;
  }

  parsePrimary(): CellValue | RangeValue {
    const t = this.next();
    if (!t) throw new FormulaError("#ERROR!");

    if (t.t === "num") return Number(t.v);
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
}

const MAX_RANGE_CELLS = 200000;

export function createEngine(cells: Cells): Engine {
  const cache = new Map<string, CellValue>();
  const stack = new Set<string>();

  const getValue = (refRaw: string): CellValue => {
    const ref = refRaw.replace(/\$/g, "").toUpperCase();
    if (cache.has(ref)) return cache.get(ref)!;
    if (stack.has(ref)) throw new FormulaError("#CIRC!");

    const raw = cells[ref]?.v ?? "";
    let val: CellValue;

    if (raw === "" || raw == null) {
      val = "";
    } else if (raw.trim().startsWith("=")) {
      stack.add(ref);
      try {
        const toks = tokenize(raw.trim().slice(1));
        if (!toks.length) val = "";
        else {
          const parser = new Parser(toks, { ref: getValue, range: getRange });
          const out = parser.parse();
          val = out instanceof RangeValue ? toNum(out) : out;
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

  const getRange = (a: string, b: string): RangeValue => {
    const pa = parseRef(a);
    const pb = parseRef(b);
    if (!pa || !pb) throw new FormulaError("#REF!");
    const r1 = Math.min(pa.r, pb.r), r2 = Math.max(pa.r, pb.r);
    const c1 = Math.min(pa.c, pb.c), c2 = Math.max(pa.c, pb.c);
    if ((r2 - r1 + 1) * (c2 - c1 + 1) > MAX_RANGE_CELLS) throw new FormulaError("#REF!");
    const values: CellValue[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        values.push(getValue(cellKey(r, c)));
      }
    }
    return new RangeValue(values);
  };

  const display = (ref: string): string => {
    const v = getValue(ref);
    if (v === "" || v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "درست" : "غلط";
    if (typeof v === "number") return formatNumber(v);
    return String(v);
  };

  return { value: getValue, display };
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
