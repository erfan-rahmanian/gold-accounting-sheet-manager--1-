import { createEngine, shiftFormula, Cells } from "./src/formula";
// سناریوی واقعی: ستون D تا ردیف ۲۰۰۰ با =D2+C3 پر شده (سقف MAX_ROWS برنامه)
const o: Record<string, string> = { D2: "1000" };
for (let r = 3; r <= 2000; r++) { o["C" + r] = "1"; o["D" + r] = shiftFormula("=D2+C3", r - 3, 0); }
const c: Cells = {}; for (const k in o) c[k] = { v: o[k] };
const t = process.hrtime.bigint();
const e = createEngine(c);
const d2000 = e.value("D2000");
const ms = Number(process.hrtime.bigint() - t) / 1e6;
console.log("D3   =", e.value("D3"), "(want 1001)");
console.log("D100 =", e.value("D100"), "(want 1098)");
console.log("D2000=", d2000, "(want 2998)", `${ms.toFixed(0)}ms`);
console.log(d2000 === 2998 ? "OK" : "BAD");
