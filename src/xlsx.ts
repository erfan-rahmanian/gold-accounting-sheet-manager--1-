// ===================================================================
// ساخت فایل واقعی اکسل (.xlsx) بدون هیچ کتابخانه‌ی بیرونی
// نکته‌ی اصلی: CSV هیچ‌جا جهتِ صفحه را نگه نمی‌دارد، پس خروجی همیشه
// چپ‌به‌راست باز می‌شد. اینجا <sheetView rightToLeft="1"/> نوشته می‌شود
// تا فایل دانلودی هم مثل خودِ برنامه راست‌به‌چپ باشد.
// ===================================================================

import { CellValue, colToName } from "./formula";

export interface XlsxCell {
  v: CellValue | null;
  /** فرمول بدون علامت =؛ خروجی اکسل آن را به‌عنوان فرمول واقعی می‌نویسد. */
  formula?: string;
  bold?: boolean;
  bg?: string;
}

export interface XlsxSheet {
  name: string;
  rows: number;
  cols: number;
  colWidths?: number[];
  cell: (r: number, c: number) => XlsxCell | null;
}

// ---------- بافر بایت با رشد خودکار ----------
class Buf {
  private a = new Uint8Array(4096);
  len = 0;

  private grow(n: number) {
    if (this.len + n <= this.a.length) return;
    let cap = this.a.length;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.a.subarray(0, this.len));
    this.a = next;
  }

  u16(v: number) {
    this.grow(2);
    this.a[this.len++] = v & 255;
    this.a[this.len++] = (v >>> 8) & 255;
  }

  u32(v: number) {
    this.grow(4);
    for (let i = 0; i < 4; i++) this.a[this.len++] = (v >>> (i * 8)) & 255;
  }

  raw(b: Uint8Array) {
    this.grow(b.length);
    this.a.set(b, this.len);
    this.len += b.length;
  }

  done() {
    return this.a.subarray(0, this.len);
  }
}

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** بسته‌بندی ZIP بدون فشرده‌سازی (متد store) — اکسل کاملاً قبولش دارد */
function zip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const out = new Buf();
  const dir = new Buf();
  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const f of entries) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const at = out.len;

    out.u32(0x04034b50);
    out.u16(20);
    out.u16(0x0800);
    out.u16(0);
    out.u16(time);
    out.u16(date);
    out.u32(crc);
    out.u32(f.data.length);
    out.u32(f.data.length);
    out.u16(name.length);
    out.u16(0);
    out.raw(name);
    out.raw(f.data);

    dir.u32(0x02014b50);
    dir.u16(20);
    dir.u16(20);
    dir.u16(0x0800);
    dir.u16(0);
    dir.u16(time);
    dir.u16(date);
    dir.u32(crc);
    dir.u32(f.data.length);
    dir.u32(f.data.length);
    dir.u16(name.length);
    dir.u16(0);
    dir.u16(0);
    dir.u16(0);
    dir.u16(0);
    dir.u32(0);
    dir.u32(at);
    dir.raw(name);
  }

  const cd = dir.done();
  const cdAt = out.len;
  out.raw(cd);
  out.u32(0x06054b50);
  out.u16(0);
  out.u16(0);
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(cd.length);
  out.u32(cdAt);
  out.u16(0);

  return new Blob([out.done()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

// ---------- کمکی‌های XML ----------
const enc = new TextEncoder();
const utf8 = (s: string) => enc.encode(s);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // کاراکترهای کنترلی که در XML مجاز نیستند
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** نام برگه در اکسل: حداکثر ۳۱ نویسه و بدون : \ / ? * [ ] */
function safeSheetName(name: string): string {
  const s = (name || "Sheet1").replace(/[\\/?*[\]:]/g, "-").slice(0, 31).trim();
  return s || "Sheet1";
}

/** رنگ #rrggbb یا #rgb به ARGB هشت‌رقمیِ اکسل */
function toARGB(color: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const h = m[1];
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  return "FF" + full.toUpperCase();
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const FIXED_DEFAULT_COLUMN_WIDTH_PX = 112;

/**
 * فرمول‌های فارسی داخلی را برای Excel به نام تابع انگلیسی تبدیل می‌کند.
 * جداکننده‌های فارسی هم به جداکننده‌ی استاندارد Excel تبدیل می‌شوند.
 */
export function toExcelFormula(formula: string): string {
  const aliases: Record<string, string> = {
    "جمع": "SUM", "مجموع": "SUM", "میانگین": "AVERAGE", "متوسط": "AVERAGE",
    "کمترین": "MIN", "حداقل": "MIN", "بیشترین": "MAX", "حداکثر": "MAX",
    "تعداد": "COUNT", "شمارش": "COUNTA", "ضرب": "PRODUCT", "حاصلضرب": "PRODUCT",
    "قدرمطلق": "ABS", "گردکردن": "ROUND", "گرد": "ROUND", "جذر": "SQRT",
    "توان": "POWER", "باقیمانده": "MOD", "اگر": "IF", "و": "AND", "یا": "OR",
    "چسباندن": "CONCAT", "طول": "LEN", "درصد": "PERCENT", "جمعاگر": "SUMIF",
    "تعداداگر": "COUNTIF", "فیلتر": "FILTER", "پالایش": "FILTER", "یکتا": "UNIQUE",
    "بیتکرار": "UNIQUE", "مرتب": "SORT", "چیدن": "SORT", "ترانهاده": "TRANSPOSE"
  };
  return formula
    .replace(/[،؛]/g, ",")
    .replace(/[A-Za-zؠ-ۿ]+(?=\s*\()/g, (name) => aliases[name] || name.toUpperCase());
}

/**
 * ساخت فایل xlsx از یک برگه.
 * جهت راست‌به‌چپ با rightToLeft="1" داخل sheetView ثبت می‌شود، دقیقاً همان
 * چیزی که اکسل هنگام زدن دکمه‌ی «برگه راست‌به‌چپ» می‌نویسد.
 */
export function buildXlsx(sheet: XlsxSheet, rtl = true): Blob {
  const name = safeSheetName(sheet.name);

  // --- جمع‌آوری سبک‌ها: هر رنگ پس‌زمینه یک fill و هر ترکیب یک xf می‌شود ---
  const fills: string[] = [];       // ARGB ها؛ ایندکس ۰ و ۱ در اکسل رزرو است
  const fillIdx = new Map<string, number>();
  const xfKey = new Map<string, number>();
  const xfs: { bold: boolean; fill: number; number: boolean }[] = [{ bold: false, fill: 0, number: false }];
  const contentWidths = Array(sheet.cols).fill(0);

  const styleOf = (bold: boolean, bg?: string, number = false): number => {
    const argb = bg ? toARGB(bg) : null;
    if (!bold && !argb) return 0;
    let fi = 0;
    if (argb) {
      if (!fillIdx.has(argb)) {
        fillIdx.set(argb, fills.length + 2); // ۲ فیلِ پیش‌فرضِ اجباری
        fills.push(argb);
      }
      fi = fillIdx.get(argb)!;
    }
    const key = `${bold ? 1 : 0}:${fi}:${number ? 1 : 0}`;
    let idx = xfKey.get(key);
    if (idx === undefined) {
      idx = xfs.length;
      xfs.push({ bold, fill: fi, number });
      xfKey.set(key, idx);
    }
    return idx;
  };

  // --- بدنه‌ی برگه ---
  const body: string[] = [];
  for (let r = 0; r < sheet.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < sheet.cols; c++) {
      const cell = sheet.cell(r, c);
      if (!cell) continue;
      const raw = cell.v;
      const empty = raw === null || raw === undefined || raw === "";
      const isNumeric = typeof raw === "number" && Number.isFinite(raw);
      const s = styleOf(!!cell.bold, cell.bg, isNumeric);
      if (empty && !s) continue;

      if (!empty) {
        const displayWidth = isNumeric ? String(raw).replace(/[eE].*$/, "").length : String(raw).length;
        contentWidths[c] = Math.max(contentWidths[c], displayWidth);
      }

      const ref = `${colToName(c)}${r + 1}`;
      const sa = s ? ` s="${s}"` : "";
      if (empty && !cell.formula) {
        cells.push(`<c r="${ref}"${sa}/>`);
      } else if (cell.formula) {
        const formula = esc(cell.formula.replace(/^=/, ""));
        const typeAttr = typeof raw === "string" ? ' t="str"' : "";
        const cached = raw === null || raw === undefined || raw === ""
          ? ""
          : `<v>${esc(String(raw))}</v>`;
        cells.push(`<c r="${ref}"${sa}${typeAttr}><f>${formula}</f>${cached}</c>`);
      } else if (isNumeric) {
        // اکسل نماد نمایی را با E بزرگ می‌نویسد
        cells.push(`<c r="${ref}"${sa}><v>${String(raw).replace("e", "E")}</v></c>`);
      } else if (typeof raw === "boolean") {
        cells.push(`<c r="${ref}"${sa} t="b"><v>${raw ? 1 : 0}</v></c>`);
      } else {
        // inlineStr تا نیازی به sharedStrings نباشد؛ فارسی هم بی‌دردسر ذخیره می‌شود
        cells.push(`<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(String(raw))}</t></is></c>`);
      }
    }
    if (cells.length) body.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  }

  // --- عرض ستون‌ها: پیکسل ⟵ واحد اکسل (تقریبِ استاندارد ۷ پیکسل برای هر نویسه) ---
  let colsXml = "";
  if (sheet.cols > 0) {
    const defs: string[] = [];
    for (let c = 0; c < sheet.cols; c++) {
      const configuredWidth = sheet.colWidths[c];
      const px = configuredWidth && Number.isFinite(configuredWidth)
        ? configuredWidth
        : FIXED_DEFAULT_COLUMN_WIDTH_PX;
      // عرض کافی برای اعداد بزرگ؛ در Excel موبایل مقدارهای طولانی نباید #### شوند.
      const minChars = Math.min(40, Math.max(12, contentWidths[c] + 2));
      const w = Math.max(1, Math.round(Math.max(((px - 5) / 7), minChars) * 100) / 100);
      defs.push(`<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`);
    }
    if (defs.length) colsXml = `<cols>${defs.join("")}</cols>`;
  }

  const dim = sheet.rows > 0 && sheet.cols > 0
    ? `<dimension ref="A1:${colToName(sheet.cols - 1)}${sheet.rows}"/>`
    : "";

  // rightToLeft باید روی خودِ sheetView باشد؛ Excel موبایل این فلگ را
  // فقط از همین بخش می‌خواند و با نبودنش ستون اول را سمت چپ می‌گذارد.
  const sheetViewsXml = rtl
    ? '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" tabSelected="1"/></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

  const sheetXml =
    XML +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    dim +
    sheetViewsXml +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    colsXml +
    `<sheetData>${body.join("")}</sheetData>` +
    "</worksheet>";

  const fillXml =
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    fills
      .map(a => `<fill><patternFill patternType="solid"><fgColor rgb="${a}"/><bgColor indexed="64"/></patternFill></fill>`)
      .join("");

  const stylesXml =
    XML +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.####################"/></numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    "</fonts>" +
    `<fills count="${fills.length + 2}">${fillXml}</fills>` +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">` +
    xfs
      .map(x =>
        `<xf numFmtId="${x.number ? 164 : 0}" fontId="${x.bold ? 1 : 0}" fillId="${x.fill}" borderId="0" xfId="0"` +
        `${x.bold ? ' applyFont="1"' : ""}${x.fill ? ' applyFill="1"' : ""}${x.number ? ' applyNumberFormat="1"' : ""}/>`
      )
      .join("") +
    "</cellXfs>" +
    "</styleSheet>";

  const workbookXml =
    XML +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets>` +
    "</workbook>";

  return zip([
    {
      name: "[Content_Types].xml",
      data: utf8(
        XML +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>"
      )
    },
    {
      name: "_rels/.rels",
      data: utf8(
        XML +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>"
      )
    },
    { name: "xl/workbook.xml", data: utf8(workbookXml) },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: utf8(
        XML +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>"
      )
    },
    { name: "xl/styles.xml", data: utf8(stylesXml) },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml) }
  ]);
}

/** دانلود یک Blob با نام دلخواه */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
