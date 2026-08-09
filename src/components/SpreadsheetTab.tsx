import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Plus, Trash, ArrowUUpLeft, ArrowUUpRight, TextB, DownloadSimple, Sigma, X, FloppyDisk, Palette, UploadSimple, PencilSimple,
  Selection, DotsThree, CaretUp
} from "@phosphor-icons/react";
import BrandIcon from "./BrandIcon";
import { SheetDoc, SheetCell } from "../types";
import {
  createEngine, cellKey, colToName, parseRef, formatNumber,
  shiftFormula, remapFormula, parseNumeric
} from "../formula";
import { toPersianDigits } from "../utils";
import { buildXlsx, downloadBlob } from "../xlsx";

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 10;
const DEFAULT_W = 112;
const MIN_W = 56;
const MAX_ROWS = 2000;
const MAX_COLS = 60;

const FILL_COLORS = [
  { label: "بدون رنگ", value: "" },
  { label: "زرد", value: "#fef9c3" },
  { label: "سبز", value: "#dcfce7" },
  { label: "قرمز", value: "#ffe4e6" },
  { label: "آبی", value: "#e0f2fe" },
  { label: "خاکستری", value: "#f1f5f9" },
  { label: "نارنجی", value: "#ffedd5" }
];

export function makeSheet(name: string): SheetDoc {
  return {
    id: "sh-" + Math.random().toString(36).slice(2, 9) + "-" + name.length,
    name,
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    colWidths: Array(DEFAULT_COLS).fill(DEFAULT_W),
    cells: {}
  };
}

interface Sel { r: number; c: number; r2: number; c2: number }

const norm = (s: Sel) => ({
  r1: Math.min(s.r, s.r2),
  rr: Math.max(s.r, s.r2),
  c1: Math.min(s.c, s.c2),
  cc: Math.max(s.c, s.c2)
});

interface Props {
  sheets?: SheetDoc[];
  onChange: (sheets: SheetDoc[]) => void;
}

export default function SpreadsheetTab({ sheets: initialSheets, onChange }: Props) {
  const [sheets, setSheets] = useState<SheetDoc[]>(() =>
    initialSheets && initialSheets.length ? initialSheets : [makeSheet("برگه ۱")]
  );
  const [activeId, setActiveId] = useState<string>(() =>
    (initialSheets && initialSheets.length ? initialSheets[0].id : "")
  );
  const sheet = sheets.find(s => s.id === activeId) || sheets[0];

  const [sel, setSel] = useState<Sel>({ r: 0, c: 0, r2: 0, c2: 0 });
  const [editing, setEditing] = useState<{ r: number; c: number; value: string } | null>(null);
  const [past, setPast] = useState<SheetDoc[][]>([]);
  const [future, setFuture] = useState<SheetDoc[][]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);
  /** روی موبایل، بخش دوم نوار ابزار و راهنما جمع می‌شود تا جدول جا بگیرد */
  const [showMore, setShowMore] = useState(false);
  /**
   * حالت «انتخاب محدوده» برای لمس.
   * وقتی خاموش است، کشیدن انگشت جدول را اسکرول می‌کند (رفتار طبیعی).
   * وقتی روشن است، کشیدن انگشت محدوده انتخاب می‌کند — همان کاری که
   * روی دسکتاپ با درگ ماوس انجام می‌شود.
   */
  const [rangeMode, setRangeMode] = useState(false);
  /** برگه‌ای که نامش در حال ویرایش است (ویرایش درجا روی خود تب) */
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  /** عرض ستون شماره ردیف و ارتفاع سلول‌ها روی موبایل فرق می‌کند */
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const formulaRef = useRef<HTMLInputElement>(null);
  const clipRef = useRef<{ raw: string[][]; text: string; r: number; c: number } | null>(null);
  const draggingRef = useRef(false);
  /** آخرین لمس: برای تشخیص «ضربه» از «کشیدن» و باز کردن ویرایش با ضربه دوم */
  const touchRef = useRef<{ r: number; c: number; x: number; y: number; moved: boolean } | null>(null);
  const resizingRef = useRef(false);
  /** بعد از Ctrl+Enter نباید onBlur دوباره ثبت کند */
  const suppressBlurRef = useRef(false);
  const firstRender = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sheets.find(s => s.id === activeId)) setActiveId(sheets[0].id);
  }, [sheets, activeId]);

  const engine = useMemo(() => createEngine(sheet.cells), [sheet.cells]);

  // ---------- ذخیره خودکار با تاخیر ----------
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(() => {
      onChange(sheets);
      setSaveState("saved");
      setTimeout(() => setSaveState(s => (s === "saved" ? "idle" : s)), 1600);
    }, 700);
    return () => clearTimeout(t);
  }, [sheets]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // ---------- تغییرات با پشتیبانی undo ----------
  const commit = useCallback((next: SheetDoc[]) => {
    setPast(p => [...p.slice(-49), sheets]);
    setFuture([]);
    setSheets(next);
  }, [sheets]);

  const updateSheet = useCallback((mut: (s: SheetDoc) => SheetDoc) => {
    commit(sheets.map(s => (s.id === sheet.id ? mut(s) : s)));
  }, [commit, sheets, sheet]);

  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [sheets, ...f.slice(0, 49)]);
    setSheets(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const nxt = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p.slice(-49), sheets]);
    setSheets(nxt);
  };

  // ---------- عملیات روی سلول‌ها ----------
  const setCellValues = (entries: { r: number; c: number; v: string }[]) => {
    updateSheet(s => {
      const cells = { ...s.cells };
      let rows = s.rows;
      let cols = s.cols;
      for (const e of entries) {
        if (e.r + 1 > rows) rows = Math.min(MAX_ROWS, e.r + 1);
        if (e.c + 1 > cols) cols = Math.min(MAX_COLS, e.c + 1);
        const key = cellKey(e.r, e.c);
        if (e.v === "") {
          const cur = cells[key];
          if (cur) {
            if (cur.b || cur.bg) cells[key] = { ...cur, v: "" };
            else delete cells[key];
          }
        } else {
          cells[key] = { ...(cells[key] || {}), v: e.v };
        }
      }
      const colWidths = [...s.colWidths];
      while (colWidths.length < cols) colWidths.push(DEFAULT_W);
      return { ...s, cells, rows, cols, colWidths };
    });
  };

  const setCellValue = (r: number, c: number, v: string) => setCellValues([{ r, c, v }]);

  const clearSelection = () => {
    const { r1, rr, c1, cc } = norm(sel);
    const entries: { r: number; c: number; v: string }[] = [];
    for (let r = r1; r <= rr; r++) for (let c = c1; c <= cc; c++) entries.push({ r, c, v: "" });
    setCellValues(entries);
  };

  const styleSelection = (patch: Partial<SheetCell>) => {
    const { r1, rr, c1, cc } = norm(sel);
    updateSheet(s => {
      const cells = { ...s.cells };
      for (let r = r1; r <= rr; r++) {
        for (let c = c1; c <= cc; c++) {
          const key = cellKey(r, c);
          const cur = cells[key] || { v: "" };
          const next = { ...cur, ...patch };
          if (!next.v && !next.b && !next.bg) delete cells[key];
          else cells[key] = next;
        }
      }
      return { ...s, cells };
    });
  };

  const toggleBold = () => {
    const { r1, c1 } = norm(sel);
    const cur = sheet.cells[cellKey(r1, c1)]?.b;
    styleSelection({ b: !cur });
  };

  // ---------- ردیف و ستون ----------
  const remapCells = (cells: Record<string, SheetCell>, map: (r: number, c: number) => { r: number; c: number } | null) => {
    const out: Record<string, SheetCell> = {};
    for (const key of Object.keys(cells)) {
      const p = parseRef(key);
      if (!p) continue;
      const target = map(p.r, p.c);
      if (!target) continue;
      const data = cells[key];
      out[cellKey(target.r, target.c)] = { ...data, v: remapFormula(data.v || "", map) };
    }
    // فرمول‌های سلول‌های جابجا نشده هم باید اصلاح شوند (بالا انجام شد چون همه سلول‌ها پیمایش شدند)
    return out;
  };

  const insertRow = (at: number, count = 1) => {
    updateSheet(s => ({
      ...s,
      rows: Math.min(MAX_ROWS, s.rows + count),
      cells: remapCells(s.cells, (r, c) => ({ r: r >= at ? r + count : r, c }))
    }));
  };

  const insertCol = (at: number, count = 1) => {
    updateSheet(s => {
      const colWidths = [...s.colWidths];
      for (let i = 0; i < count; i++) colWidths.splice(at, 0, DEFAULT_W);
      return {
        ...s,
        cols: Math.min(MAX_COLS, s.cols + count),
        colWidths,
        cells: remapCells(s.cells, (r, c) => ({ r, c: c >= at ? c + count : c }))
      };
    });
  };

  const deleteRows = () => {
    const { r1, rr } = norm(sel);
    const count = rr - r1 + 1;
    if (sheet.rows - count < 1) { showToast("حداقل یک ردیف باید باقی بماند."); return; }
    updateSheet(s => ({
      ...s,
      rows: s.rows - count,
      cells: remapCells(s.cells, (r, c) => (r >= r1 && r <= rr ? null : { r: r > rr ? r - count : r, c }))
    }));
    setSel({ r: r1, c: sel.c, r2: r1, c2: sel.c });
  };

  const deleteCols = () => {
    const { c1, cc } = norm(sel);
    const count = cc - c1 + 1;
    if (sheet.cols - count < 1) { showToast("حداقل یک ستون باید باقی بماند."); return; }
    updateSheet(s => {
      const colWidths = [...s.colWidths];
      colWidths.splice(c1, count);
      return {
        ...s,
        cols: s.cols - count,
        colWidths,
        cells: remapCells(s.cells, (r, c) => (c >= c1 && c <= cc ? null : { r, c: c > cc ? c - count : c }))
      };
    });
    setSel({ r: sel.r, c: c1, r2: sel.r, c2: c1 });
  };

  const addRows = (n: number) => updateSheet(s => ({ ...s, rows: Math.min(MAX_ROWS, s.rows + n) }));
  const addCols = (n: number) => updateSheet(s => {
    const cols = Math.min(MAX_COLS, s.cols + n);
    const colWidths = [...s.colWidths];
    while (colWidths.length < cols) colWidths.push(DEFAULT_W);
    return { ...s, cols, colWidths };
  });

  // ---------- عملیات ریاضی سریع روی انتخاب ----------
  /** اولین ردیف کاملاً خالی بعد از ردیف rr در محدوده ستون‌های c1..cc (تا سقف ۵۰ ردیف) */
  const freeRowBelow = (rr: number, c1: number, cc: number) => {
    for (let r = rr + 1; r <= rr + 50; r++) {
      let busy = false;
      for (let c = c1; c <= cc; c++) {
        if ((sheet.cells[cellKey(r, c)]?.v ?? "") !== "") { busy = true; break; }
      }
      if (!busy) return r;
    }
    return rr + 1;
  };

  /** اولین ستون کاملاً خالی بعد از ستون cc در محدوده ردیف‌های r1..rr */
  const freeColAfter = (cc: number, r1: number, rr: number) => {
    for (let c = cc + 1; c <= cc + 50; c++) {
      let busy = false;
      for (let r = r1; r <= rr; r++) {
        if ((sheet.cells[cellKey(r, c)]?.v ?? "") !== "") { busy = true; break; }
      }
      if (!busy) return c;
    }
    return cc + 1;
  };

  const applyOp = (op: "sum" | "sub" | "mul" | "div" | "avg") => {
    const { r1, rr, c1, cc } = norm(sel);
    if (r1 === rr && c1 === cc) {
      showToast("ابتدا چند سلول (یک ستون یا یک ردیف) را انتخاب کنید.");
      return;
    }

    const build = (refs: string[], rangeRef: string) => {
      switch (op) {
        case "sum": return `=SUM(${rangeRef})`;
        case "avg": return `=AVERAGE(${rangeRef})`;
        case "sub": return "=" + refs.join("-");
        case "mul": return "=" + refs.join("*");
        case "div": return "=" + refs.join("/");
      }
    };

    const entries: { r: number; c: number; v: string }[] = [];

    if (rr > r1) {
      // اعمال روی هر ستون → نتیجه در اولین ردیف خالی بعد از انتخاب
      const targetRow = freeRowBelow(rr, c1, cc);
      for (let c = c1; c <= cc; c++) {
        const refs: string[] = [];
        for (let r = r1; r <= rr; r++) refs.push(cellKey(r, c));
        entries.push({ r: targetRow, c, v: build(refs, `${cellKey(r1, c)}:${cellKey(rr, c)}`) });
      }
      setSel({ r: targetRow, c: c1, r2: targetRow, c2: cc });
    } else {
      // یک ردیف → نتیجه در اولین ستون خالی بعد از انتخاب
      const targetCol = freeColAfter(cc, r1, r1);
      const refs: string[] = [];
      for (let c = c1; c <= cc; c++) refs.push(cellKey(r1, c));
      entries.push({ r: r1, c: targetCol, v: build(refs, `${cellKey(r1, c1)}:${cellKey(r1, cc)}`) });
      setSel({ r: r1, c: targetCol, r2: r1, c2: targetCol });
    }

    setCellValues(entries);
    showToast(op === "sum" ? "جمع محاسبه شد ✓" : op === "avg" ? "میانگین محاسبه شد ✓" : "فرمول درج شد ✓");
  };

  /** جمع کامل جدول: هم زیر هر ستون هم انتهای هر ردیف */
  const totalTable = () => {
    const { r1, rr, c1, cc } = norm(sel);
    if (r1 === rr && c1 === cc) { showToast("ابتدا محدوده جدول را انتخاب کنید."); return; }
    const entries: { r: number; c: number; v: string }[] = [];
    const tr = freeRowBelow(rr, c1, cc);
    const tc = freeColAfter(cc, r1, rr);
    for (let c = c1; c <= cc; c++) entries.push({ r: tr, c, v: `=SUM(${cellKey(r1, c)}:${cellKey(rr, c)})` });
    for (let r = r1; r <= rr; r++) entries.push({ r, c: tc, v: `=SUM(${cellKey(r, c1)}:${cellKey(r, cc)})` });
    entries.push({ r: tr, c: tc, v: `=SUM(${cellKey(r1, c1)}:${cellKey(rr, cc)})` });
    setCellValues(entries);
    showToast("جمع ردیف‌ها و ستون‌ها ساخته شد ✓");
  };

  // ---------- ویرایش ----------
  const startEdit = (r: number, c: number, initial?: string) => {
    const raw = initial !== undefined ? initial : (sheet.cells[cellKey(r, c)]?.v ?? "");
    setEditing({ r, c, value: raw });
    setTimeout(() => {
      editRef.current?.focus();
      if (initial === undefined) editRef.current?.select();
    }, 0);
  };

  const commitEdit = (move: "down" | "right" | "left" | "up" | "none" = "none") => {
    if (!editing) return;
    const { r, c, value } = editing;
    const prev = sheet.cells[cellKey(r, c)]?.v ?? "";
    if (value !== prev) setCellValue(r, c, value);
    setEditing(null);
    let nr = r, nc = c;
    if (move === "down") nr = Math.min(sheet.rows - 1, r + 1);
    if (move === "up") nr = Math.max(0, r - 1);
    if (move === "right") nc = Math.min(sheet.cols - 1, c + 1);
    if (move === "left") nc = Math.max(0, c - 1);
    setSel({ r: nr, c: nc, r2: nr, c2: nc });
    setTimeout(() => containerRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditing(null);
    setTimeout(() => containerRef.current?.focus(), 0);
  };

  /**
   * محتوای در حال ویرایش را در تمام محدوده‌ی انتخاب‌شده می‌ریزد (Ctrl+Enter).
   * ارجاع‌های نسبیِ فرمول برای هر خانه جابجا می‌شود، دقیقاً مثل کشیدنِ دستگیره.
   * برای وقتی است که کاربر کل یک ستون را انتخاب کرده و می‌خواهد فرمول روی
   * همه‌ی خانه‌های آن اعمال شود.
   */
  const fillSelection = () => {
    if (!editing) return;
    const { r, c, value } = editing;
    const { r1, rr, c1, cc } = norm(sel);
    if (r1 === rr && c1 === cc) { commitEdit("down"); return; }

    // جلوگیری از اینکه onBlur دوباره همان مقدار را ثبت کند و یک گام undo اضافه بسازد
    suppressBlurRef.current = true;

    const entries: { r: number; c: number; v: string }[] = [];
    for (let row = r1; row <= rr; row++) {
      for (let col = c1; col <= cc; col++) {
        entries.push({ r: row, c: col, v: shiftFormula(value, row - r, col - c) });
      }
    }
    setEditing(null);
    setCellValues(entries);
    setTimeout(() => containerRef.current?.focus(), 0);
    showToast(`فرمول روی ${toPersianDigits(entries.length)} خانه اعمال شد ✓`);
  };

  // ---------- ناوبری با کیبورد (چیدمان راست‌به‌چپ) ----------
  const moveSel = (dr: number, dc: number, extend: boolean) => {
    setSel(s => {
      const r2 = Math.max(0, Math.min(sheet.rows - 1, (extend ? s.r2 : s.r) + dr));
      const c2 = Math.max(0, Math.min(sheet.cols - 1, (extend ? s.c2 : s.c) + dc));
      if (extend) return { ...s, r2, c2 };
      return { r: r2, c: c2, r2, c2 };
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); return; }
    if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
    if (mod && (e.key === "b" || e.key === "B")) { e.preventDefault(); toggleBold(); return; }
    if (mod && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      setSel({ r: 0, c: 0, r2: sheet.rows - 1, c2: sheet.cols - 1 });
      return;
    }
    if (mod && (e.key === "c" || e.key === "v" || e.key === "x")) return; // توسط رویداد کلیپ‌بورد

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); moveSel(-1, 0, e.shiftKey); return;
      case "ArrowDown": e.preventDefault(); moveSel(1, 0, e.shiftKey); return;
      case "ArrowLeft": e.preventDefault(); moveSel(0, 1, e.shiftKey); return;   // RTL: چپ = ستون بعد
      case "ArrowRight": e.preventDefault(); moveSel(0, -1, e.shiftKey); return; // RTL: راست = ستون قبل
      case "Tab": e.preventDefault(); moveSel(0, e.shiftKey ? -1 : 1, false); return;
      case "Enter":
        e.preventDefault();
        if (e.altKey) startEdit(sel.r, sel.c);
        else moveSel(e.shiftKey ? -1 : 1, 0, false);
        return;
      case "F2": e.preventDefault(); startEdit(sel.r, sel.c); return;
      case "Delete":
      case "Backspace": e.preventDefault(); clearSelection(); return;
      case "Home":
        e.preventDefault();
        if (mod) setSel({ r: 0, c: 0, r2: 0, c2: 0 });
        else setSel(s => ({ r: s.r, c: 0, r2: s.r, c2: 0 }));
        return;
      case "Escape": return;
    }

    if (!mod && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      startEdit(sel.r, sel.c, e.key);
    }
  };

  // ---------- کپی / بریدن / چسباندن ----------
  const insideGrid = () => {
    const el = document.activeElement;
    return !!el && (el === containerRef.current || !!containerRef.current?.contains(el));
  };

  useEffect(() => {
    const buildClip = () => {
      const { r1, rr, c1, cc } = norm(sel);
      const lines: string[] = [];
      const raw: string[][] = [];
      for (let r = r1; r <= rr; r++) {
        const line: string[] = [];
        const rawLine: string[] = [];
        for (let c = c1; c <= cc; c++) {
          const key = cellKey(r, c);
          const v = engine.value(key);
          line.push(typeof v === "number" ? String(v) : String(v ?? ""));
          rawLine.push(sheet.cells[key]?.v ?? "");
        }
        lines.push(line.join("\t"));
        raw.push(rawLine);
      }
      return { text: lines.join("\n"), raw, r: r1, c: c1 };
    };

    const onCopy = (e: ClipboardEvent) => {
      if (!insideGrid() || editing) return;
      const clip = buildClip();
      e.clipboardData?.setData("text/plain", clip.text);
      e.preventDefault();
      clipRef.current = clip;
    };

    const onCut = (e: ClipboardEvent) => {
      if (!insideGrid() || editing) return;
      const clip = buildClip();
      e.clipboardData?.setData("text/plain", clip.text);
      e.preventDefault();
      clipRef.current = clip;
      clearSelection();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!insideGrid() || editing) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text) return;
      e.preventDefault();

      const internal = clipRef.current && clipRef.current.text === text ? clipRef.current : null;
      const grid = internal
        ? internal.raw
        : text.replace(/\r/g, "").split("\n").map(l => l.split("\t"));
      while (grid.length && grid[grid.length - 1].every(v => v === "")) grid.pop();
      if (!grid.length) return;

      const { r1, c1 } = norm(sel);
      const dr = internal ? r1 - internal.r : 0;
      const dc = internal ? c1 - internal.c : 0;
      const entries: { r: number; c: number; v: string }[] = [];
      grid.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const r = r1 + ri;
          const c = c1 + ci;
          if (r >= MAX_ROWS || c >= MAX_COLS) return;
          const v = internal && val.trim().startsWith("=") ? shiftFormula(val, dr, dc) : val;
          entries.push({ r, c, v });
        });
      });
      setCellValues(entries);
      setSel({ r: r1, c: c1, r2: r1 + grid.length - 1, c2: c1 + Math.max(...grid.map(g => g.length)) - 1 });
      showToast("چسبانده شد ✓");
    };

    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [sel, sheet, editing, engine]);

  // ---------- درگ انتخاب ----------
  useEffect(() => {
    const up = () => { draggingRef.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ---------- تغییر عرض ستون (ماوس و لمس) ----------
  const startResize = (e: React.MouseEvent | React.TouchEvent, colIdx: number) => {
    e.stopPropagation();
    if (resizingRef.current) return;
    resizingRef.current = true;

    const pointX = (ev: MouseEvent | TouchEvent) =>
      "touches" in ev ? ev.touches[0]?.clientX : (ev as MouseEvent).clientX;

    const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const startW = sheet.colWidths[colIdx] ?? DEFAULT_W;

    const move = (ev: MouseEvent | TouchEvent) => {
      const x = pointX(ev);
      if (x === undefined) return;
      // چیدمان راست‌به‌چپ است، پس کشیدن به چپ یعنی پهن‌تر شدن
      const w = Math.max(MIN_W, startW + (startX - x));
      setSheets(prev => prev.map(s => {
        if (s.id !== sheet.id) return s;
        const colWidths = [...s.colWidths];
        colWidths[colIdx] = w;
        return { ...s, colWidths };
      }));
    };

    const up = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
  };

  // ---------- انتخاب با لمس ----------
  /** سلولِ زیر انگشت را از روی مختصات صفحه پیدا می‌کند */
  const cellAtPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest("[data-cell]");
    const key = el?.getAttribute("data-cell");
    return key ? parseRef(key) : null;
  };

  const onGridTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const tr = touchRef.current;
    if (!t || !tr) return;
    if (!tr.moved && (Math.abs(t.clientX - tr.x) > 8 || Math.abs(t.clientY - tr.y) > 8)) {
      tr.moved = true;
    }
    if (!rangeMode || !tr.moved) return;
    const p = cellAtPoint(t.clientX, t.clientY);
    if (p) setSel(s => (s.r2 === p.r && s.c2 === p.c ? s : { ...s, r2: p.r, c2: p.c }));
  };

  const onGridTouchEnd = (e: React.TouchEvent) => {
    const tr = touchRef.current;
    touchRef.current = null;
    if (!tr || tr.moved) return;
    // ضربه‌ی ساده: بار اول سلول را انتخاب می‌کند، بار دوم ویرایش را باز می‌کند.
    // preventDefault جلوی رویدادهای ماوسِ ساختگی را می‌گیرد تا انتخاب دوباره صفر نشود.
    e.preventDefault();
    if (editing) { commitEdit("none"); return; }
    if (sel.r === tr.r && sel.c === tr.c && sel.r2 === tr.r && sel.c2 === tr.c) startEdit(tr.r, tr.c);
    else setSel({ r: tr.r, c: tr.c, r2: tr.r, c2: tr.c });
  };

  // ---------- اسکرول به سلول فعال ----------
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-cell="${cellKey(sel.r, sel.c)}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel.r, sel.c]);

  // ---------- برگه‌ها ----------
  const addSheet = () => {
    const s = makeSheet("برگه " + (sheets.length + 1));
    commit([...sheets, s]);
    setActiveId(s.id);
    setSel({ r: 0, c: 0, r2: 0, c2: 0 });
  };

  const removeSheet = (id: string) => {
    if (sheets.length === 1) { showToast("حداقل یک برگه باید باقی بماند."); return; }
    if (!window.confirm("این برگه و تمام محتوایش حذف شود؟")) return;
    const next = sheets.filter(s => s.id !== id);
    commit(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  /** شروع ویرایش نام برگه (روی خود تب، بدون پنجره‌ی مرورگر) */
  const startRename = (id: string) => {
    const cur = sheets.find(s => s.id === id);
    if (!cur) return;
    setRenaming({ id, value: cur.name });
  };

  /** ثبت نام جدید؛ نام خالی یا بدون تغییر نادیده گرفته می‌شود */
  const commitRename = () => {
    if (!renaming) return;
    const name = renaming.value.trim();
    const cur = sheets.find(s => s.id === renaming.id);
    setRenaming(null);
    if (!name || !cur || name === cur.name) return;
    commit(sheets.map(s => (s.id === renaming.id ? { ...s, name } : s)));
  };

  // فوکوس و انتخاب کامل متن، به محض باز شدن ویرایش نام
  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming?.id]);

  // ---------- خروجی اکسل (xlsx) ----------
  // CSV جهتِ صفحه را ذخیره نمی‌کند و همیشه چپ‌به‌راست باز می‌شود؛
  // فایل xlsx راست‌به‌چپ بودن برگه، درشتی و رنگ خانه‌ها را هم نگه می‌دارد.
  const exportXlsx = () => {
    const blob = buildXlsx({
      name: sheet.name,
      rows: sheet.rows,
      cols: sheet.cols,
      colWidths: sheet.colWidths,
      cell: (r, c) => {
        const key = cellKey(r, c);
        const data = sheet.cells[key];
        const v = engine.value(key);
        if ((v === "" || v === null || v === undefined) && !data?.b && !data?.bg) return null;
        return { v: v ?? "", bold: data?.b, bg: data?.bg };
      }
    });
    downloadBlob(blob, `${sheet.name}.xlsx`);
    showToast("فایل اکسل راست‌به‌چپ ساخته شد ✓");
  };

  // ---------- خروجی و ورودی CSV ----------
  const exportCSV = () => {
    const rows: string[] = [];
    for (let r = 0; r < sheet.rows; r++) {
      const line: string[] = [];
      for (let c = 0; c < sheet.cols; c++) {
        const v = engine.value(cellKey(r, c));
        const s = typeof v === "number" ? String(v) : String(v ?? "");
        line.push(/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
      }
      rows.push(line.join(","));
    }
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { row.push(cur); cur = ""; }
        else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (ch !== "\r") cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
    while (rows.length && rows[rows.length - 1].every(v => v.trim() === "")) rows.pop();
    return rows;
  };

  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^﻿/, "");
      const grid = parseCSV(text);
      if (!grid.length) return;
      const entries: { r: number; c: number; v: string }[] = [];
      grid.forEach((rw, ri) => rw.forEach((v, ci) => {
        if (ri < MAX_ROWS && ci < MAX_COLS) entries.push({ r: ri, c: ci, v });
      }));
      setCellValues(entries);
      showToast("فایل وارد شد ✓");
    };
    reader.readAsText(file, "utf-8");
  };

  // ---------- نوار وضعیت انتخاب ----------
  const stats = useMemo(() => {
    const { r1, rr, c1, cc } = norm(sel);
    const nums: number[] = [];
    let filled = 0;
    for (let r = r1; r <= rr; r++) {
      for (let c = c1; c <= cc; c++) {
        const v = engine.value(cellKey(r, c));
        if (v === "" || v === null || v === undefined) continue;
        filled++;
        if (typeof v === "number") nums.push(v);
        else if (typeof v === "string" && !v.startsWith("#")) {
          const n = parseNumeric(v);
          if (n !== null) nums.push(n);
        }
      }
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      count: filled,
      numCount: nums.length,
      sum,
      avg: nums.length ? sum / nums.length : 0,
      min: nums.length ? Math.min(...nums) : 0,
      max: nums.length ? Math.max(...nums) : 0,
      cells: (rr - r1 + 1) * (cc - c1 + 1)
    };
  }, [sel, engine, sheet.cells]);

  const activeKey = cellKey(sel.r, sel.c);
  const activeRaw = sheet.cells[activeKey]?.v ?? "";
  /** اگر خانه‌ی فعال نتیجه‌ی سرریزِ یک فرمول آرایه‌ای باشد، خانه‌ی مبدأ */
  const activeSpillFrom = activeRaw === "" ? engine.spilledFrom(activeKey) : null;
  const { r1, rr, c1, cc } = norm(sel);

  const btn = "inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all border min-h-[38px] md:min-h-[36px] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const btnGray = `${btn} bg-white border-slate-200 text-slate-700 hover:bg-slate-100`;
  const btnAmber = `${btn} bg-amber-500 border-amber-500 text-slate-950 hover:bg-amber-400`;

  return (
    <div className="space-y-3 animate-fadeIn" dir="rtl">
      {/* نوار ابزار */}
      <div className="bg-white border border-slate-200 rounded-3xl p-3 md:p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <BrandIcon name="spreadsheet" size={20} />
            صفحه گسترده (اکسل داخلی)
          </h3>
          <div className="flex items-center gap-2">
            {saveState === "saving" && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <FloppyDisk className="w-3 h-3" /> در حال ذخیره...
              </span>
            )}
            {saveState === "saved" && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <FloppyDisk className="w-3 h-3" /> ذخیره شد
              </span>
            )}
          </div>
        </div>

        {/* دکمه‌ها — روی موبایل فقط ردیف اول دیده می‌شود */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button className={btnGray} onClick={undo} disabled={!past.length} title="واگرد (Ctrl+Z)">
              <ArrowUUpLeft className="w-3.5 h-3.5" />
            </button>
            <button className={btnGray} onClick={redo} disabled={!future.length} title="ازنو (Ctrl+Y)">
              <ArrowUUpRight className="w-3.5 h-3.5" />
            </button>
            <button className={btnGray} onClick={toggleBold} title="درشت (Ctrl+B)">
              <TextB className="w-3.5 h-3.5" />
            </button>

            <div className="relative">
              <button className={btnGray} onClick={() => setShowColors(v => !v)} title="رنگ پس‌زمینه">
                <Palette className="w-3.5 h-3.5" />
              </button>
              {showColors && (
                <div className="absolute z-40 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg p-2 grid grid-cols-4 gap-1.5 w-44">
                  {FILL_COLORS.map(col => (
                    <button
                      key={col.label}
                      title={col.label}
                      onClick={() => { styleSelection({ bg: col.value }); setShowColors(false); }}
                      className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
                      style={{ background: col.value || "#fff" }}
                    >
                      {!col.value && <X className="w-3 h-3 text-slate-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="w-px h-6 bg-slate-200 mx-1" />

            <button className={btnAmber} onClick={() => applyOp("sum")} title="جمع سلول‌های انتخاب‌شده">
              <Sigma className="w-3.5 h-3.5" /> جمع
            </button>

            {/*
              روی دسکتاپ محدوده را با درگ ماوس یا Shift انتخاب می‌کنید؛ روی گوشی
              چنین چیزی وجود ندارد و کشیدن انگشت باید جدول را اسکرول کند.
              پس این کلید، لمس را موقتاً به حالت «انتخاب» می‌برد.
            */}
            <button
              className={rangeMode ? btnAmber : btnGray}
              onClick={() => setRangeMode(v => !v)}
              title="انتخاب محدوده با کشیدن انگشت"
            >
              <Selection className="w-3.5 h-3.5" />
              <span className="md:hidden">انتخاب</span>
            </button>

            <button
              className={`${btnGray} md:hidden`}
              onClick={() => setShowMore(v => !v)}
              title="ابزارهای بیشتر"
            >
              {showMore ? <CaretUp className="w-3.5 h-3.5" /> : <DotsThree className="w-3.5 h-3.5" />}
              {showMore ? "بستن" : "بیشتر"}
            </button>
          </div>

          <div className={`${showMore ? "flex" : "hidden"} md:flex flex-wrap items-center gap-1.5`}>
            <button className={btnGray} onClick={() => applyOp("sub")} title="تفریق">−  تفریق</button>
            <button className={btnGray} onClick={() => applyOp("mul")} title="ضرب">×  ضرب</button>
            <button className={btnGray} onClick={() => applyOp("div")} title="تقسیم">÷  تقسیم</button>
            <button className={btnGray} onClick={() => applyOp("avg")} title="میانگین">میانگین</button>
            <button className={btnGray} onClick={totalTable} title="جمع ردیف‌ها و ستون‌های جدول">جمع کل جدول</button>

            <span className="w-px h-6 bg-slate-200 mx-1" />

            <button className={btnGray} onClick={() => insertRow(r1, rr - r1 + 1)} title="درج ردیف">
              <Plus className="w-3.5 h-3.5" /> ردیف
            </button>
            <button className={btnGray} onClick={() => insertCol(c1, cc - c1 + 1)} title="درج ستون">
              <Plus className="w-3.5 h-3.5" /> ستون
            </button>
            <button className={btnGray} onClick={deleteRows} title="حذف ردیف‌های انتخابی">
              <Trash className="w-3.5 h-3.5" /> ردیف
            </button>
            <button className={btnGray} onClick={deleteCols} title="حذف ستون‌های انتخابی">
              <Trash className="w-3.5 h-3.5" /> ستون
            </button>
            <button className={btnGray} onClick={() => addRows(10)}>+۱۰ ردیف</button>
            <button className={btnGray} onClick={() => addCols(3)}>+۳ ستون</button>

            <span className="w-px h-6 bg-slate-200 mx-1" />

            <button className={btnGray} onClick={exportXlsx} title="خروجی اکسل، راست‌به‌چپ با رنگ و قلم">
              <DownloadSimple className="w-3.5 h-3.5" /> خروجی اکسل
            </button>
            <button className={btnGray} onClick={exportCSV} title="خروجی CSV ساده (بدون جهت و رنگ)">
              <DownloadSimple className="w-3.5 h-3.5" /> CSV
            </button>
            <button className={btnGray} onClick={() => fileRef.current?.click()} title="ورود فایل CSV">
              <UploadSimple className="w-3.5 h-3.5" /> ورود CSV
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ""; }}
          />
        </div>

        {/* نوار فرمول */}
        <div className="flex items-stretch gap-1.5 md:gap-2">
          <div className="bg-slate-100 border border-slate-200 rounded-xl px-2 md:px-3 flex items-center font-mono font-black text-[11px] text-slate-700 min-w-[52px] md:min-w-[74px] justify-center shrink-0">
            {activeKey}
          </div>
          <div className="hidden sm:flex items-center px-2 bg-slate-100 border border-slate-200 rounded-xl text-amber-600 font-black text-[12px] italic shrink-0">fx</div>
          <input
            ref={formulaRef}
            value={editing ? editing.value : activeRaw}
            onChange={e => setEditing({ r: sel.r, c: sel.c, value: e.target.value })}
            onFocus={() => { if (!editing) setEditing({ r: sel.r, c: sel.c, value: activeRaw }); }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Ctrl+Enter: اعمال روی کل محدوده‌ی انتخاب‌شده
                if (e.ctrlKey || e.metaKey) { fillSelection(); formulaRef.current?.blur(); return; }
                commitEdit("down");
                formulaRef.current?.blur();
              }
              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); formulaRef.current?.blur(); }
            }}
            onBlur={() => {
              if (suppressBlurRef.current) { suppressBlurRef.current = false; return; }
              if (editing) commitEdit("none");
            }}
            placeholder={
              activeSpillFrom
                ? `نتیجه‌ی سرریزِ فرمول خانه ${activeSpillFrom} — برای ویرایش، همان خانه را باز کنید`
                : isMobile ? "محتوا یا فرمول: =SUM(A1:A10)" : "محتوای سلول یا فرمول: مثلاً =SUM(A1:A10)  یا  =A1*B1"
            }
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-mono focus:outline-none focus:border-amber-500"
            dir="ltr"
          />
        </div>

        {/* راهنما — روی موبایل زیر دکمه «بیشتر» جمع می‌شود تا جای جدول را نگیرد */}
        <p className={`${showMore ? "block" : "hidden"} md:block text-[10px] text-slate-500 font-semibold leading-relaxed`}>
          راهنما: با کلیک و کشیدن، محدوده انتخاب کنید و دکمه‌های جمع/تفریق/ضرب/تقسیم را بزنید تا فرمول خودکار ساخته شود.
          روی گوشی، اول کلید <span className="font-bold text-amber-700">انتخاب محدوده</span> را بزنید و بعد انگشت را روی سلول‌ها بکشید؛
          یک ضربه سلول را انتخاب و ضربه دوم آن را باز می‌کند.
          فرمول دستی با <span className="font-mono text-amber-700">=</span> شروع می‌شود؛ مثل
          <span className="font-mono text-amber-700"> =A1+B2 </span>،
          <span className="font-mono text-amber-700"> =SUM(A1:A10) </span>،
          <span className="font-mono text-amber-700"> =جمع(B1:B9) </span>،
          <span className="font-mono text-amber-700"> =میانگین(C1:C5) </span>.
          کل یک ستون را هم می‌شود آدرس داد:
          <span className="font-mono text-amber-700"> =SUM(C:C) </span>.
          توابع آرایه‌ای مثل
          <span className="font-mono text-amber-700"> =FILTER(C:C؛ C:C&lt;&gt;"") </span>
          را در <span className="font-bold text-amber-700">اولین خانه</span> بنویسید؛ نتیجه خودش در خانه‌های پایین سرریز می‌شود
          (اگر خانه‌های پایین پر باشند، خطای <span className="font-mono text-amber-700">#SPILL!</span> می‌دهد).
          برای اعمال یک فرمول معمولی روی کل ستون، ستون را انتخاب کنید، فرمول را بنویسید و
          <span className="font-bold text-amber-700"> Ctrl+Enter </span> بزنید.
          کپی/چسباندن مستقیم از اکسل هم کار می‌کند.
        </p>
      </div>

      {/* شبکه سلول‌ها */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchMove={onGridTouchMove}
        onTouchEnd={onGridTouchEnd}
        onTouchCancel={() => { touchRef.current = null; }}
        // در حالت انتخاب، اسکرولِ مرورگر باید خاموش شود وگرنه کشیدن انگشت
        // به‌جای انتخاب، جدول را جابه‌جا می‌کند.
        style={{ touchAction: rangeMode ? "none" : "pan-x pan-y" }}
        className={`bg-white border rounded-2xl shadow-sm overflow-auto max-h-[60vh] md:max-h-[68vh] focus:outline-none focus:ring-2 focus:ring-amber-400/40 select-none ${
          rangeMode ? "border-amber-400 ring-2 ring-amber-400/30" : "border-slate-200"
        }`}
      >
        <table className="border-collapse table-fixed" style={{ width: "max-content" }}>
          <colgroup>
            <col style={{ width: isMobile ? 38 : 52 }} />
            {Array.from({ length: sheet.cols }).map((_, c) => (
              <col key={c} style={{ width: sheet.colWidths[c] ?? DEFAULT_W }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 right-0 z-30 bg-slate-100 border border-slate-200 text-[10px] text-slate-400 font-black h-9 md:h-8" />
              {Array.from({ length: sheet.cols }).map((_, c) => {
                const active = c >= c1 && c <= cc;
                return (
                  <th
                    key={c}
                    onMouseDown={() => setSel({ r: 0, c, r2: sheet.rows - 1, c2: c })}
                    className={`sticky top-0 z-20 border border-slate-200 text-[11px] font-black h-9 md:h-8 cursor-pointer relative ${active ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {colToName(c)}
                    {/* دستگیره‌ی تغییر عرض — روی موبایل پهن‌تر است تا با انگشت گرفته شود */}
                    <span
                      onMouseDown={e => startResize(e, c)}
                      onTouchStart={e => startResize(e, c)}
                      className="absolute top-0 bottom-0 left-0 w-3 md:w-1.5 cursor-col-resize touch-none hover:bg-amber-500/60 active:bg-amber-500/60"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }).map((_, r) => (
              <tr key={r}>
                <th
                  onMouseDown={() => setSel({ r, c: 0, r2: r, c2: sheet.cols - 1 })}
                  className={`sticky right-0 z-10 border border-slate-200 text-[11px] font-black h-9 md:h-[30px] cursor-pointer ${r >= r1 && r <= rr ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {r + 1}
                </th>
                {Array.from({ length: sheet.cols }).map((_, c) => {
                  const key = cellKey(r, c);
                  const data = sheet.cells[key];
                  const isEditing = editing && editing.r === r && editing.c === c;
                  const isActive = sel.r === r && sel.c === c;
                  const inRange = r >= r1 && r <= rr && c >= c1 && c <= cc;
                  const val = isEditing ? "" : engine.value(key);
                  const isNum = typeof val === "number";
                  const isErr = typeof val === "string" && val.startsWith("#");
                  const text = isEditing
                    ? ""
                    : val === "" || val === null || val === undefined
                      ? ""
                      : isNum
                        ? formatNumber(val as number)
                        : typeof val === "boolean"
                          ? (val ? "درست" : "غلط")
                          : String(val);

                  return (
                    <td
                      key={c}
                      data-cell={key}
                      onTouchStart={e => {
                        const t = e.touches[0];
                        touchRef.current = { r, c, x: t?.clientX ?? 0, y: t?.clientY ?? 0, moved: false };
                        if (rangeMode) setSel({ r, c, r2: r, c2: c });
                      }}
                      onMouseDown={e => {
                        if (e.shiftKey || rangeMode) { setSel(s => ({ ...s, r2: r, c2: c })); return; }
                        draggingRef.current = true;
                        setSel({ r, c, r2: r, c2: c });
                        if (editing) commitEdit("none");
                        containerRef.current?.focus();
                      }}
                      onMouseEnter={() => {
                        if (draggingRef.current) setSel(s => ({ ...s, r2: r, c2: c }));
                      }}
                      onDoubleClick={() => startEdit(r, c)}
                      style={{ background: !inRange && data?.bg ? data.bg : undefined }}
                      className={`border border-slate-200 h-9 md:h-[30px] px-1.5 text-[12px] md:text-[11.5px] align-middle overflow-hidden whitespace-nowrap cursor-cell relative
                        ${data?.b ? "font-black" : "font-medium"}
                        ${isNum ? "text-left font-mono" : "text-right"}
                        ${isErr ? "text-rose-600 font-bold" : "text-slate-800"}
                        ${isActive ? "outline outline-2 outline-amber-500 z-[5] bg-white" : inRange ? "bg-amber-500/10" : data?.bg ? "" : "bg-white"}`}
                    >
                      {isEditing ? (
                        <input
                          ref={editRef}
                          value={editing!.value}
                          onChange={e => setEditing({ r, c, value: e.target.value })}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              e.preventDefault();
                              // Ctrl+Enter: اعمال روی کل محدوده‌ی انتخاب‌شده
                              if (e.ctrlKey || e.metaKey) fillSelection();
                              else commitEdit(e.shiftKey ? "up" : "down");
                            }
                            else if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? "left" : "right"); }
                            else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                          }}
                          onBlur={() => {
                            if (suppressBlurRef.current) { suppressBlurRef.current = false; return; }
                            commitEdit("none");
                          }}
                          dir={/^\s*=/.test(editing!.value) ? "ltr" : "auto"}
                          className="absolute inset-0 w-full h-full px-1.5 text-[12px] md:text-[11.5px] font-mono border-2 border-amber-500 outline-none bg-white text-slate-900 z-10"
                        />
                      ) : (
                        <span className="block truncate" title={data?.v && data.v.startsWith("=") ? data.v : undefined}>
                          {text}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* نوار وضعیت + برگه‌ها */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/*
          روی موبایل تب‌ها به‌جای اینکه در چند سطر بپیچند و نصف صفحه را بگیرند،
          در یک نوارِ افقیِ اسکرول‌شونده می‌نشینند.
        */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 lg:flex-wrap lg:overflow-visible lg:pb-0 lg:mb-0">
          {sheets.map(s => (
            <div
              key={s.id}
              className={`flex items-center gap-1 shrink-0 rounded-xl border px-2.5 py-2 lg:py-1.5 text-[11px] font-extrabold cursor-pointer transition-all ${
                s.id === activeId ? "bg-amber-500 border-amber-500 text-slate-950" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => {
                if (renaming?.id === s.id) return;
                setActiveId(s.id);
                setSel({ r: 0, c: 0, r2: 0, c2: 0 });
              }}
              onDoubleClick={() => startRename(s.id)}
              title={renaming?.id === s.id ? undefined : "دوبار کلیک (یا دکمه مداد) برای تغییر نام"}
            >
              {renaming?.id === s.id ? (
                <input
                  ref={renameRef}
                  value={renaming.value}
                  autoFocus
                  onChange={e => setRenaming({ id: s.id, value: e.target.value })}
                  onClick={e => e.stopPropagation()}
                  onDoubleClick={e => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                    else if (e.key === "Escape") { e.preventDefault(); setRenaming(null); }
                  }}
                  className="w-24 bg-white text-slate-900 border-2 border-amber-600 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold outline-none"
                />
              ) : (
                <>
                  <span>{s.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); startRename(s.id); }}
                    className="opacity-60 hover:opacity-100 hover:text-blue-700"
                    title="تغییر نام برگه"
                  >
                    <PencilSimple className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeSheet(s.id); }}
                    className="opacity-60 hover:opacity-100 hover:text-rose-600"
                    title="حذف برگه"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
          <button onClick={addSheet} className={`${btnGray} shrink-0`} title="برگه جدید">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/*
          آمار انتخاب. روی موبایل دو ستونی می‌شود؛ کمترین/بیشترین که کمتر لازم‌اند
          فقط از تبلت به بالا نشان داده می‌شوند تا نوار کوتاه بماند.
        */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:items-center sm:gap-3 sm:flex-wrap text-[11px] font-bold text-slate-600 font-mono">
          <span>
            <span className="text-slate-400 font-sans">انتخاب: </span>
            <span className="text-slate-800">{cellKey(r1, c1)}{(r1 !== rr || c1 !== cc) ? `:${cellKey(rr, cc)}` : ""}</span>
          </span>
          <span><span className="text-slate-400 font-sans">جمع: </span><span className="text-emerald-700 font-black">{formatNumber(stats.sum)}</span></span>
          <span><span className="text-slate-400 font-sans">میانگین: </span>{formatNumber(stats.avg)}</span>
          <span><span className="text-slate-400 font-sans">تعداد عدد: </span>{stats.numCount}</span>
          <span className="hidden sm:inline"><span className="text-slate-400 font-sans">کمترین: </span>{formatNumber(stats.min)}</span>
          <span className="hidden sm:inline"><span className="text-slate-400 font-sans">بیشترین: </span>{formatNumber(stats.max)}</span>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg z-[200] animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}
