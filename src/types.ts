export interface Shop {
  id: string;
  name: string;
  initialGold: number;
  initialIRR: number;
  note: string;
}

export interface Coin {
  name: string;
  weight: number;
}

export interface Transaction {
  id: string;
  rowNumber?: number;
  date: string;
  shop: string;
  type: string;
  subType: string;
  coinType: string;
  coinCount: number;
  person: string;
  goldWeight: number; // Melted gold weight (Stated as "وزن طلا آبشده گرم")
  coinWeight: number; // Stated as "وزن سکه گرم"
  amount: number; // Stated as "مبلغ (ریال)"
  salesAmount: number; // Stated as "مبلغ فروش (ریال)"
  goldCredit: number; // Stated as "بستانکاری طلا"
  goldDebit: number; // Stated as "بدهکاری طلا"
  irrCredit: number; // Stated as "بستانکاری ریال"
  irrDebit: number; // Stated as "بدهکاری ریال"
  profit: number; // Stated as "سود/زیان"
  note: string;
}

export interface AppSettings {
  shops: Shop[];
  persons: string[];
  coins: Coin[];
  currentGoldPrice: number;
  spreadsheetId: string;
}

export interface AppState {
  settings: AppSettings;
  transactions: Transaction[];
}

export const TRANSACTION_TYPES = [
  "خرید طلا",
  "فروش طلا",
  "خرید و فروش",
  "خرید سکه",
  "فروش سکه",
  "دریافت وجه",
  "دریافت سکه",
  "دریافت آبشده",
  "پرداخت وجه",
  "پرداخت سکه",
  "پرداخت آبشده",
  "آبشده",
  "سند حسابداری"
] as const;
