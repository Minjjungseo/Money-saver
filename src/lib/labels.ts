/**
 * Central Korean UI label dictionary. All user-facing strings live here so
 * screens never hardcode text inline — keeps translation in one place and
 * leaves room for a future locale switch. Real-world data (merchant names,
 * bank names, imported memos) is never translated and never belongs here.
 */
import type {
  AccountType,
  PlannedExpenseStatus,
  RecurringFrequency,
  TransactionType,
} from "@/types";

export const NAV_LABELS = {
  home: "홈",
  transactions: "내역",
  plan: "예정",
  accounts: "계좌",
  insights: "분석",
  add: "추가",
} as const;

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "지출",
  INCOME: "수입",
  TRANSFER: "계좌이동",
  EXCHANGE: "환전",
  REFUND: "환불",
  CASH_WITHDRAWAL: "현금인출",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "입출금",
  SAVINGS: "저축",
  CASH: "현금",
  CREDIT_CARD: "신용카드",
  INVESTMENT: "투자",
  OTHER: "기타",
};

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: "매주",
  FORTNIGHTLY: "2주마다",
  MONTHLY: "매월",
  QUARTERLY: "3개월마다",
  SIX_MONTHLY: "6개월마다",
  YEARLY: "매년",
};

export const PLANNED_EXPENSE_STATUS_LABELS: Record<PlannedExpenseStatus, string> = {
  PLANNED: "예정",
  PAID: "완료",
  CANCELLED: "취소",
};

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "직접 입력",
  IMAGE_IMPORT: "이미지 인식",
  CSV_IMPORT: "파일 불러오기",
  JSON_IMPORT: "파일 불러오기",
};
