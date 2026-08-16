import { createEngine, Cells } from "./src/formula";
const mk = (n: number): Cells => {
  const c: Cells = { A1: { v: "1" } };
  for (let r = 2; r <= n; r++) c["A" + r] = { v: `=A${r - 1}+1` };
  return c;
};
for (const n of [2001, 5000, 20000, 60000]) {
  const t = process.hrtime.bigint();
  const v = createEngine(mk(n)).value("A" + n);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(`depth ${n}: A${n} = ${JSON.stringify(v)}  (${ms.toFixed(0)}ms)  ${v === n ? "OK" : "BAD"}`);
}
// حلقه‌ی دوریِ بسیار بلند نباید کرش کند
const cyc: Cells = {};
for (let r = 1; r <= 5000; r++) cyc["B" + r] = { v: `=B${r === 5000 ? 1 : r + 1}` };
console.log("long cycle B1 =", createEngine(cyc).value("B1"));
