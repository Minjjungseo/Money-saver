import type { Account, AccountType, Category, CurrencyCode, Transaction, TransactionType } from "@/types";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import { parseFlexibleDate, resolveDateColumn } from "@/lib/dateParsing";

/** Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas, and "" escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a leading UTF-8 BOM — common in files exported from Excel/은행 앱, and
  // otherwise silently corrupts the first header cell's name (e.g. "﻿날짜"
  // never matches any alias, breaking every row that depends on that column).
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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
  /** Free-text time-of-day from a separate "시간"/"time" column, if the file has one — never blocks date parsing, folded into memo since Transaction has no time-of-day field. */
  time: string;
  merchant: string;
  amountMinor: number;
  currency: CurrencyCode;
  transactionType: TransactionType;
  categoryName: string;
  subcategory: string;
  accountName: string;
  memo: string;
  /** Raw source-system fields, preserved verbatim for audit when the CSV carries them (e.g. Notion's 분류/성격/고정변동, or a plain "분류"/"category" column). Never used for calculation. */
  sourceClassification: string;
  sourceNature: string;
  sourceFixedVariable: string;
}

/** One row's import failure, detailed enough to show in the UI without guessing at the cause. */
export interface ImportRowError {
  /** 1-indexed file line number (header is line 1). */
  line: number;
  /** The file's own header text for the column involved, or "(없음)" when no column matched at all. */
  rawHeader: string;
  rawValue: string;
  /** Canonical field this column would have mapped to (date/amount/currency/...). */
  mappedField: string;
  reason: string;
}

export interface ParseTransactionsCsvResult {
  rows: TransactionCsvRow[];
  errors: ImportRowError[];
  /** True when the file has a column recognized as an account/card name — false means the UI must ask the person which account these belong to, rather than guessing. */
  hasAccountColumn: boolean;
  /** Row count excluding the header, whether or not each one parsed successfully. */
  totalDataRows: number;
}

/**
 * Canonical field -> accepted header spellings, matched after normalizing
 * (BOM/whitespace stripped, case-insensitive). A header is also accepted as
 * a match when it starts with "<alias>_" (e.g. "지출금액_AUD"), which lets a
 * currency-suffixed amount column resolve both the field AND a default
 * currency (see amountCurrencyHint below) without a separate 통화 column.
 * Extend this table — never hardcode a new file's exact header text
 * elsewhere — when the next import uses a spelling not covered here.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "날짜", "거래일", "결제일"],
  time: ["time", "시간"],
  merchant: ["merchant", "가맹점", "사용처", "상호명"],
  category: ["category", "분류", "카테고리"],
  subcategory: ["subcategory", "세부분류"],
  amount: ["amount", "금액", "지출금액"],
  currency: ["currency", "통화"],
  transaction_type: ["transaction_type", "거래유형", "유형"],
  account: ["account", "계좌", "카드"],
  memo: ["memo", "note", "메모"],
  source_classification: ["source_classification"],
  source_nature: ["source_nature"],
  source_fixed_variable: ["source_fixed_variable"],
};

function normalizeHeaderCell(raw: string): string {
  return raw.replace(/^﻿/, "").trim().toLowerCase();
}

/** Canonical field this header cell maps to, or null if it doesn't match any known alias. */
function resolveHeaderField(rawHeader: string): string | null {
  const norm = normalizeHeaderCell(rawHeader);
  if (!norm) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (norm === alias || norm.startsWith(`${alias}_`)) return field;
    }
  }
  return null;
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

export function parseTransactionsCsv(text: string): ParseTransactionsCsvResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [], hasAccountColumn: false, totalDataRows: 0 };

  const rawHeader = table[0];
  const fieldToCol = new Map<string, number>();
  const rawHeaderByField = new Map<string, string>();
  let amountCurrencyHint: CurrencyCode | null = null;

  rawHeader.forEach((h, colIndex) => {
    const field = resolveHeaderField(h);
    if (!field || fieldToCol.has(field)) return; // first matching column wins if a header repeats
    fieldToCol.set(field, colIndex);
    rawHeaderByField.set(field, h.trim());
    if (field === "amount") {
      const suffix = /_([A-Za-z]{3})$/.exec(h.trim())?.[1]?.toUpperCase();
      if (suffix === "AUD" || suffix === "KRW") amountCurrencyHint = suffix;
    }
  });

  const get = (cols: string[], field: string): string => {
    const colIndex = fieldToCol.get(field);
    return colIndex !== undefined ? (cols[colIndex] ?? "").trim() : "";
  };

  const dataRows = table.slice(1);
  const dateColIndex = fieldToCol.get("date");
  // Resolved together (not row by row) so an ambiguous D/M vs M/D column is
  // decided once from whatever the rest of the file makes clear — see
  // resolveDateColumn.
  const dateResults = dateColIndex !== undefined ? resolveDateColumn(dataRows.map((cols) => (cols[dateColIndex] ?? "").trim())) : null;

  const rows: TransactionCsvRow[] = [];
  const errors: ImportRowError[] = [];

  dataRows.forEach((cols, i) => {
    const line = i + 2; // +1 for 1-indexing, +1 for the header row

    if (dateColIndex === undefined || !dateResults) {
      errors.push({
        line,
        rawHeader: "(없음)",
        rawValue: "",
        mappedField: "date",
        reason: "파일에서 날짜로 인식할 수 있는 컬럼을 찾지 못했어요",
      });
      return;
    }
    const rawDate = (cols[dateColIndex] ?? "").trim();
    const dateResult = dateResults.get(rawDate) ?? parseFlexibleDate(rawDate);
    if (!dateResult.date) {
      errors.push({
        line,
        rawHeader: rawHeaderByField.get("date") ?? "(없음)",
        rawValue: rawDate,
        mappedField: "date",
        reason: dateResult.reason ?? "날짜를 인식할 수 없어요",
      });
      return;
    }

    const amountRaw = get(cols, "amount");
    const amountNum = Number(amountRaw.replace(/,/g, ""));
    if (!amountRaw || isNaN(amountNum)) {
      errors.push({
        line,
        rawHeader: rawHeaderByField.get("amount") ?? "(없음)",
        rawValue: amountRaw,
        mappedField: "amount",
        reason: "금액이 숫자가 아니에요",
      });
      return;
    }

    const currencyRaw = get(cols, "currency");
    const currency = (currencyRaw || amountCurrencyHint || "AUD").toUpperCase() as CurrencyCode;
    if (currency !== "AUD" && currency !== "KRW") {
      errors.push({
        line,
        rawHeader: rawHeaderByField.get("currency") ?? "(없음)",
        rawValue: currencyRaw,
        mappedField: "currency",
        reason: `지원하지 않는 통화예요 ("${currencyRaw}")`,
      });
      return;
    }

    const typeRaw = get(cols, "transaction_type").toUpperCase() as TransactionType;
    const transactionType = VALID_TYPES.includes(typeRaw) ? typeRaw : "EXPENSE";

    const time = get(cols, "time");
    const rawMemo = get(cols, "memo");
    const memo = time ? [time, rawMemo].filter(Boolean).join(" · ") : rawMemo;
    const categoryName = get(cols, "category");

    rows.push({
      date: dateResult.date,
      time,
      merchant: get(cols, "merchant") || "알 수 없음",
      amountMinor: toMinorUnits(Math.abs(amountNum), currency),
      currency,
      transactionType,
      categoryName,
      subcategory: get(cols, "subcategory"),
      accountName: get(cols, "account"),
      memo,
      sourceClassification: get(cols, "source_classification") || categoryName,
      sourceNature: get(cols, "source_nature"),
      sourceFixedVariable: get(cols, "source_fixed_variable"),
    });
  });

  return {
    rows,
    errors,
    hasAccountColumn: fieldToCol.has("account"),
    totalDataRows: dataRows.length,
  };
}

const ACCOUNT_HEADERS = ["name", "bank", "currency", "balance", "type", "include_in_available", "balance_as_of"];

export function accountsToCsv(accounts: Account[]): string {
  const lines = [toRow(ACCOUNT_HEADERS)];
  for (const a of accounts) {
    lines.push(
      toRow([
        a.name,
        a.bank,
        a.currency,
        toMajorUnits(a.balanceMinor, a.currency),
        a.type,
        a.includeInAvailable ? "true" : "false",
        a.balanceAsOfDate ?? "",
      ])
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
  /** ISO date (yyyy-MM-dd) the balance was confirmed as of, or null if the file doesn't say — treated as "unconfirmed", not zero. */
  balanceAsOfDate: string | null;
}

const VALID_ACCOUNT_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAccountsCsv(text: string): { rows: AccountCsvRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["빈 파일이에요."] };
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
      errors.push(`${i + 1}번째 줄: 이름이 없어요`);
      continue;
    }
    if (!balanceRaw || isNaN(balanceNum)) {
      errors.push(`${i + 1}번째 줄: 잔고가 올바르지 않아요`);
      continue;
    }
    const typeRaw = get("type").toUpperCase() as AccountType;
    const balanceAsOfRaw = get("balance_as_of");
    rows.push({
      name,
      bank: get("bank"),
      currency: currency === "KRW" ? "KRW" : "AUD",
      balanceMinor: toMinorUnits(balanceNum, currency === "KRW" ? "KRW" : "AUD"),
      type: VALID_ACCOUNT_TYPES.includes(typeRaw) ? typeRaw : "OTHER",
      includeInAvailable: get("include_in_available").toLowerCase() !== "false",
      balanceAsOfDate: ISO_DATE_RE.test(balanceAsOfRaw) ? balanceAsOfRaw : null,
    });
  }
  return { rows, errors };
}
