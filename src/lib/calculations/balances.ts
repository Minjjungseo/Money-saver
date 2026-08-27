import type { Account, CurrencyCode, ExchangeRate } from "@/types";
import { convertToBase } from "@/lib/exchange";

/** Sum of all account balances flagged includeInAvailable, converted to base currency. */
export function calculateTotalBalances(
  accounts: Account[],
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return accounts
    .filter((a) => a.includeInAvailable)
    .reduce((sum, a) => sum + convertToBase(a.balanceMinor, a.currency, baseCurrency, rates), 0);
}

/** Sum of every account balance regardless of the include flag, for the Accounts screen. */
export function calculateAllAccountsTotal(
  accounts: Account[],
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return accounts.reduce(
    (sum, a) => sum + convertToBase(a.balanceMinor, a.currency, baseCurrency, rates),
    0
  );
}
