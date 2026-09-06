import { differenceInCalendarDays } from "date-fns";
import type { CurrencyCode, Transaction } from "@/types";

interface DuplicateCandidate {
  date: string;
  amountMinor: number;
  merchant: string;
  accountId: string | null;
  /** Optional — when supplied, a currency mismatch never counts as a duplicate (same numeric amount in AUD vs KRW is not the same transaction). */
  currency?: CurrencyCode;
}

/**
 * Flags likely duplicate imports (e.g. the same bank screenshot uploaded twice,
 * or the same real-world transaction arriving via two different sources).
 * Matches on date proximity + exact amount (+ currency, when known) + merchant
 * similarity + account, per the product spec's date+account+merchant+amount
 * +currency fingerprint. Never auto-deletes — callers surface this as a
 * warning and let the user decide.
 */
export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  existing: Transaction[]
): Transaction | null {
  const candidateDate = new Date(`${candidate.date}T00:00:00`);
  const candidateMerchant = normalizeMerchant(candidate.merchant);

  for (const tx of existing) {
    if (tx.amountMinor !== candidate.amountMinor) continue;
    if (candidate.currency && tx.currency !== candidate.currency) continue;
    if (candidate.accountId && tx.accountId && tx.accountId !== candidate.accountId) continue;

    const txDate = new Date(`${tx.date}T00:00:00`);
    if (Math.abs(differenceInCalendarDays(candidateDate, txDate)) > 2) continue;

    const txMerchant = normalizeMerchant(tx.merchant);
    if (txMerchant.includes(candidateMerchant) || candidateMerchant.includes(txMerchant)) {
      return tx;
    }
  }
  return null;
}

function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
