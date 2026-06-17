import { Transaction, Coin } from "./types";

export function getCoinWeight(coinName: string, count: number, coins: Coin[]): number {
  const coin = coins.find(c => c.name === coinName);
  if (!coin) return 0;
  return count * coin.weight;
}

export function calculateTransactionFields(
  tx: Partial<Transaction>,
  coins: Coin[]
): Partial<Transaction> {
  const type = tx.type || "";
  const goldWeight = Number(tx.goldWeight) || 0;
  const coinType = tx.coinType || "";
  const coinCount = Number(tx.coinCount) || 0;
  const amount = Number(tx.amount) || 0;
  const salesAmount = Number(tx.salesAmount) || 0;

  // Compute automatic coin weight
  let coinWeight = 0;
  if (type === "دریافت سکه" || type === "پرداخت سکه") {
    coinWeight = getCoinWeight(coinType, coinCount, coins);
  }

  let goldCredit = 0;
  let goldDebit = 0;
  let irrCredit = 0;
  let irrDebit = 0;
  let profit = 0;

  switch (type) {
    case "خرید طلا":
      goldCredit = goldWeight;
      irrDebit = amount;
      break;

    case "فروش طلا":
      goldDebit = goldWeight;
      irrCredit = amount;
      break;

    case "خرید و فروش":
    case "خرید و فروش (امروزی)":
    case "خرید و فروش (فردایی)":
      goldCredit = goldWeight;
      irrDebit = amount;
      goldDebit = goldWeight;
      irrCredit = salesAmount;
      profit = salesAmount - amount;
      break;

    case "دریافت وجه":
      irrCredit = amount;
      break;

    case "دریافت سکه":
      goldCredit = coinWeight;
      irrCredit = amount;
      break;

    case "دریافت آبشده":
      goldCredit = goldWeight;
      irrCredit = amount;
      break;

    case "پرداخت وجه":
      irrDebit = amount;
      break;

    case "پرداخت سکه":
      goldDebit = coinWeight;
      irrDebit = amount;
      break;

    case "پرداخت آبشده":
      goldDebit = goldWeight;
      irrDebit = amount;
      break;

    case "آبشده":
      goldDebit = goldWeight;
      irrCredit = amount;
      break;

    case "سند حسابداری":
      // Manual inputs are used, we just keep whatever fields are set or default to 0
      goldCredit = Number(tx.goldCredit) || 0;
      goldDebit = Number(tx.goldDebit) || 0;
      irrCredit = Number(tx.irrCredit) || 0;
      irrDebit = Number(tx.irrDebit) || 0;
      profit = Number(tx.profit) || 0;
      break;

    default:
      break;
  }

  return {
    ...tx,
    coinWeight,
    goldCredit,
    goldDebit,
    irrCredit,
    irrDebit,
    profit
  };
}

// Format number with thousands separator (Farsi digits optional, but standard format helper)
export function formatCurrency(num: number): string {
  return new Intl.NumberFormat("fa-IR", {
    style: "decimal",
    maximumFractionDigits: 0
  }).format(num) + " ریال";
}

export function formatWeight(num: number): string {
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(num) + " گرم";
}

// Convert English digits to Persian
export function toPersianDigits(str: string | number): string {
  const pAr = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (w) => pAr[+w]);
}

// Dynamically formats standard input values by adding thousands separators while typing
export function formatInputWithCommas(val: string | number): string {
  const strVal = String(val);
  if (!strVal) return "";
  const clean = strVal.replace(/,/g, "");
  const parts = clean.split(".");
  const integerPart = parts[0];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (parts.length > 1) {
    return formattedInteger + "." + parts[1].slice(0, 4);
  }
  return formattedInteger;
}

// Format dates in simple Jalali structure if preferred, or returns standard representation
export function getTodayJalali(): string {
  // Simple Jalali date estimator for 2026/06/17 (which is 1405/03/27)
  // Let's calculate exactly based on today's year
  const today = new Date();
  const options = { calendar: "persian", year: "numeric", month: "2-digit", day: "2-digit" } as any;
  try {
    const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", options).format(today);
    // clean formatting from non-breaking spaces or characters
    return formatted.replace(/[\u200E\u200F]/g, "").trim();
  } catch (e) {
    return "۱۴۰۵/۰۳/۲۷";
  }
}
