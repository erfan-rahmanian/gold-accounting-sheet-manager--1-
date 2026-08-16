import { createEngine, Cells } from "./src/formula";
const mk = (n: number): Cells => {
  const c: Cells = { A1: { v: "1" } };
  for (let r = 2; r <= n; r++) c["A" + r] = { v: `=A${r - 1}+1` };
  return c;
};
let lo = 1, hi = 4000;
while (lo < hi) {
  const mid = Math.ceil((lo + hi) / 2);
  const v = createEngine(mk(mid)).value("A" + mid);
  if (v === mid) lo = mid; else hi = mid - 1;
}
console.log("max working chain depth:", lo);
console.log("at depth", lo + 1, "→", createEngine(mk(lo + 1)).value("A" + (lo + 1)));
