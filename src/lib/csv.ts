import type { Account, AccountType, Category, CurrencyCode, Transaction, TransactionType } from "@/types";
import { toMinorUnits, toMajorUnits } from "@/lib/money";

/** Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas, and "" escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRow(values: (string | number)[]): string {
  return values.map((v) => csvField(String(v))).join(",");
}

const TRANSACTION_HEADERS = [
  "date",
  "merchant",
  "amount",
  "currency",
  "transaction_type",
  "category",
  "subcategory",
  "account",
  "memo",
];

export interface TransactionCsvRow {
  date: string;
  merchant: string;
  amountMinor: number;
  currency: CurrencyCode;
  transactionType: TransactionType;
  categoryName: string;
  subcategory: string;
  accountName: string;
  memo: string;
}

export function transactionsToCsv(transactions: Transaction[], categories: Category[], accounts: Account[]): string {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const lines = [toRow(TRANSACTION_HEADERS)];
  for (const tx of transactions) {
    lines.push(
      toRow([
        tx.date,
        tx.merchant,
        toMajorUnits(tx.amountMinor, tx.currency),
        tx.currency,
        tx.transactionType,
        tx.categoryId ? categoryById.get(tx.categoryId)?.name ?? "" : "",
        tx.subcategory ?? "",
        tx.accountId ? accountById.get(tx.accountId)?.name ?? "" : "",
        tx.memo ?? "",
      ])
    );
  }
  return lines.join("\n");
}

const VALID_TYPES: TransactionType[] = ["EXPENSE", "INCOME", "TRANSFER", "EXCHANGE", "REFUND", "CASH_WITHDRAWAL"];

export function parseTransactionsCsv(text: string): { rows: TransactionCsvRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["Empty file"] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const rows: TransactionCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    const get = (name: string) => (idx(name) >= 0 ? (cols[idx(name)] ?? "").trim() : "");
    const date = get("date");
    const amountRaw = get("amount");
    const currency = (get("currency") || "AUD").toUpperCase() as CurrencyCode;
    const typeRaw = get("transaction_type").toUpperCase() as TransactionType;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${i + 1}: invalid or missing date`);
      continue;
    }
    const amountNum = Number(amountRaw);
    if (!amountRaw || isNaN(amountNum)) {
      errors.push(`Row ${i + 1}: invalid amount`);
      continue;
    }
    if (currency !== "AUD" && currency !== "KRW") {
      errors.push(`Row ${i + 1}: unsupported currency "${currency}"`);
      continue;
    }
    const transactionType = VALID_TYPES.includes(typeRaw) ? typeRaw : "EXPENSE";

    rows.push({
      date,
      merchant: get("merchant") || "Unknown",
      amountMinor: toMinorUnits(Math.abs(amountNum), currency),
      currency,
      transactionType,
      categoryName: get("category"),
      subcategory: get("subcategory"),
      accountName: get("account"),
      memo: get("memo"),
    });
  }

  return { rows, errors };
}

const ACCOUNT_HEADERS = ["name", "bank", "currency", "balance", "type", "include_in_available"];

export function accountsToCsv(accounts: Account[]): string {
  const lines = [toRow(ACCOUNT_HEADERS)];
  for (const a of accounts) {
    lines.push(
      toRow([a.name, a.bank, a.currency, toMajorUnits(a.balanceMinor, a.currency), a.type, a.includeInAvailable ? "true" : "false"])
    );
  }
  return lines.join("\n");
}

export interface AccountCsvRow {
  name: string;
  bank: string;
  currency: CurrencyCode;
  balanceMinor: number;
  type: AccountType;
  includeInAvailable: boolean;
}

const VALID_ACCOUNT_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"];

export function parseAccountsCsv(text: string): { rows: AccountCsvRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["Empty file"] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const rows: AccountCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    const get = (name: string) => (idx(name) >= 0 ? (cols[idx(name)] ?? "").trim() : "");
    const name = get("name");
    const currency = (get("currency") || "AUD").toUpperCase() as CurrencyCode;
    const balanceRaw = get("balance");
    const balanceNum = Number(balanceRaw);
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }
    if (!balanceRaw || isNaN(balanceNum)) {
      errors.push(`Row ${i + 1}: invalid balance`);
      continue;
    }
    const typeRaw = get("type").toUpperCase() as AccountType;
    rows.push({
      name,
      bank: get("bank"),
      currency: currency === "KRW" ? "KRW" : "AUD",
      balanceMinor: toMinorUnits(balanceNum, currency === "KRW" ? "KRW" : "AUD"),
      type: VALID_ACCOUNT_TYPES.includes(typeRaw) ? typeRaw : "OTHER",
      includeInAvailable: get("include_in_available").toLowerCase() !== "false",
    });
  }
  return { rows, errors };
}
