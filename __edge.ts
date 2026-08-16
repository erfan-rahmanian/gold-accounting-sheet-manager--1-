import { createEngine, Cells } from "./src/formula";
let fail = 0;
const eq = (l: string, got: unknown, want: unknown) => {
  const ok = String(got) === String(want); if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};
const mk = (o: Record<string, string>): Cells => {
  const c: Cells = {}; for (const k in o) c[k] = { v: o[k] }; return c;
};

// نام تابع نباید ارجاع حساب شود (SUM شبیه ارجاع نیست ولی مثلا LOG10 یا تابعی مثل C3 نامعتبر)
eq("fn name not a ref", createEngine(mk({ A1: "=SUM(1;2)" })).value("A1"), 3);

// ارجاع مطلق $D$2
eq("absolute ref", createEngine(mk({ D2: "5", A1: "=$D$2*2" })).value("A1"), 10);

// زنجیره از طریق محدوده: A3 = SUM(A1:A2) و A4 = SUM(A1:A3)
eq("range chain", createEngine(mk({ A1: "1", A2: "2", A3: "=SUM(A1:A2)", A4: "=SUM(A1:A3)" })).value("A4"), 6);

// حلقه از طریق محدوده: A1 = SUM(A1:A3) باید CIRC بدهد
eq("cycle via range", createEngine(mk({ A1: "=SUM(A1:A3)", A2: "1", A3: "2" })).value("A1"), "#CIRC!");

// حلقه از طریق ارجاع کل ستون
eq("cycle via whole col", createEngine(mk({ A1: "=SUM(A:A)", A2: "3" })).value("A1"), "#CIRC!");

// SUM روی ستون دیگر با زنجیره
const e = createEngine(mk({ C1: "1", C2: "2", C3: "3", D1: "=SUM(C:C)", E1: "=D1*2" }));
eq("whole col sum", e.value("D1"), 6);
eq("chain on whole col sum", e.value("E1"), 12);

// ارجاع به خانه‌ی خالی
eq("empty ref", createEngine(mk({ A1: "=B9+1" })).value("A1"), 1);

// حلقه‌ی دو خانه‌ای که یکی از آنها هم توسط خانه‌ی سالم خوانده می‌شود
const e2 = createEngine(mk({ A1: "=A2", A2: "=A1", A3: "=A1+1" }));
eq("cyc A1", e2.value("A1"), "#CIRC!");
eq("dependent of cycle", e2.value("A3"), "#CIRC!");

// ردیف کامل 1:1
const e3 = createEngine(mk({ A1: "1", B1: "2", A3: "=SUM(1:1)" }));
eq("row range", e3.value("A3"), 3);

// IF با شاخه‌ای که به خانه‌ی حلقه‌دار اشاره می‌کند ولی اجرا نمی‌شود
eq("IF short-circuit not required", createEngine(mk({ A1: "=IF(1=1;5;A1)" })).value("A1"), "#CIRC!");

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
