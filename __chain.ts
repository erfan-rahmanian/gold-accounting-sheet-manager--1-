import { createEngine, shiftFormula, Cells } from "./src/formula";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const mk = (o: Record<string, string>): Cells => {
  const c: Cells = {};
  for (const k in o) c[k] = { v: o[k] };
  return c;
};

// ── سناریوی کاربر: D2 عدد دارد، D3 = D2+C3، بازه D3:D10 با Ctrl+Enter پر می‌شود
console.log("\n== 1) running total via fill ==");
const base: Record<string, string> = { D2: "100" };
for (let r = 3; r <= 10; r++) base["C" + r] = String(r);   // C3..C10 = 3..10
const src = "=D2+C3";
for (let r = 3; r <= 10; r++) base["D" + r] = shiftFormula(src, r - 3, 0);
eq("D4 formula rewritten", base.D4, "=D3+C4");
eq("D5 formula rewritten", base.D5, "=D4+C5");
eq("D10 formula rewritten", base.D10, "=D9+C10");

const e1 = createEngine(mk(base));
let run = 100;
for (let r = 3; r <= 10; r++) {
  run += r;
  eq(`D${r} running total`, e1.value("D" + r), run);
}

// ── ترتیب محاسبه مستقل از ترتیب ردیف: زنجیره از پایین به بالا
console.log("\n== 2) reverse-order chain (bottom depends on top defined later) ==");
const e2 = createEngine(mk({ A1: "=A2+1", A2: "=A3+1", A3: "=A4+1", A4: "5" }));
eq("A1", e2.value("A1"), 8);
eq("A2", e2.value("A2"), 7);
eq("A3", e2.value("A3"), 6);

// ── حلقه‌ی دوری
console.log("\n== 3) circular reference ==");
const e3 = createEngine(mk({ D3: "=D5+1", D5: "=D3+1" }));
eq("D3 circular", e3.value("D3"), "#CIRC!");
eq("D5 circular", e3.value("D5"), "#CIRC!");

const e4 = createEngine(mk({ B1: "=B1" }));
eq("self reference", e4.value("B1"), "#CIRC!");

const e5 = createEngine(mk({ X1: "=X2", X2: "=X3", X3: "=X1" }));
eq("3-cycle", e5.value("X1"), "#CIRC!");

// ── زنجیره‌ی طولانی: عمق بازگشتی
console.log("\n== 4) long chain depth ==");
const deep: Record<string, string> = { A1: "1" };
for (let r = 2; r <= 1200; r++) deep["A" + r] = `=A${r - 1}+1`;
const e6 = createEngine(mk(deep));
eq("A1200 deep chain", e6.value("A1200"), 1200);

// ── زنجیره کنار فرمول آرایه‌ای
console.log("\n== 5) chain reading a spilled cell ==");
const e7 = createEngine(mk({
  C1: "10", C2: "", C3: "20", C4: "30",
  F1: '=FILTER(C:C; C:C<>"")',
  H1: "0", H2: "=H1+F1", H3: "=H2+F2",
}));
eq("F1 spill anchor", e7.value("F1"), 10);
eq("F2 spilled", e7.value("F2"), 20);
eq("H2 chain on anchor", e7.value("H2"), 10);
eq("H3 chain on spilled", e7.value("H3"), 30);

// ── خطا در وسط زنجیره باید منتشر شود، نه کرش
console.log("\n== 6) error propagation along a chain ==");
const e8 = createEngine(mk({ A1: "=1/0", A2: "=A1+1", A3: "=A2+1" }));
eq("A1", e8.value("A1"), "#DIV/0!");
eq("A2 propagates", e8.value("A2"), "#DIV/0!");
eq("A3 propagates", e8.value("A3"), "#DIV/0!");

// ── حلقه در یک شاخه نباید محاسبه‌ی شاخه‌ی سالم را خراب کند
console.log("\n== 7) cycle isolated from healthy cells ==");
const e9 = createEngine(mk({ P1: "=P2", P2: "=P1", Q1: "7", Q2: "=Q1*2" }));
eq("P1 cyc", e9.value("P1"), "#CIRC!");
eq("Q2 healthy", e9.value("Q2"), 14);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILURES"}`);
