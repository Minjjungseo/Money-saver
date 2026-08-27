import { differenceInCalendarDays } from "date-fns";
import type { Transaction } from "@/types";

interface DuplicateCandidate {
  date: string;
  amountMinor: number;
  merchant: string;
  accountId: string | null;
}

/**
 * Flags likely duplicate imports (e.g. the same bank screenshot uploaded twice).
 * Matches on date proximity + exact amount + merchant similarity + account, per
 * the product spec. Never auto-deletes — callers surface this as a warning and
 * let the user decide.
 */
export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  existing: Transaction[]
): Transaction | null {
  const candidateDate = new Date(`${candidate.date}T00:00:00`);
  const candidateMerchant = normalizeMerchant(candidate.merchant);

  for (const tx of existing) {
    if (tx.amountMinor !== candidate.amountMinor) continue;
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
