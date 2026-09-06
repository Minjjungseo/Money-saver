/**
 * Flexible date parsing for imported files. Money OS transactions always
 * store dates as ISO yyyy-MM-dd; this module is the ONLY place that turns a
 * messy real-world date string into that shape (or refuses to, explicitly —
 * never guessing/defaulting to today). See parseFlexibleDate for single
 * values and resolveDateColumn for whole-column DD/MM vs MM/DD disambiguation.
 */

export interface DateParseResult {
  /** ISO yyyy-MM-dd, or null when the value couldn't be confidently parsed. */
  date: string | null;
  /** Human-readable reason a value failed or needs review, for the import-error UI. */
  reason: string | null;
  /** True for a slash-separated date whose day/month order is genuinely ambiguous (both parts ≤ 12). */
  ambiguous: boolean;
}

const KOREAN_DATE_RE = /^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const YYYYMMDD_RE = /^(\d{4})(\d{2})(\d{2})$/;
/** ISO-ish: YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD, optionally with a trailing time (space or "T" separated). */
const ISO_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}(:\d{2})?)?$/;
/** D/M/Y or M/D/Y style, slash or dash separated, 1-2 digit day/month, 4-digit year — order resolved by resolveDateColumn. */
const SLASH_DMY_RE = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

/** Excel/Sheets serial date (days since 1899-12-30, matching the traditional Lotus 1-2-3 leap-year bug Excel preserved). */
function fromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 86400000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Parses a single date value. Slash/dash D-M-Y vs M-D-Y values that are
 * genuinely ambiguous (both components ≤ 12) come back with `ambiguous:
 * true` and `date: null` — the caller (resolveDateColumn) decides the whole
 * column's order from context, or leaves them for manual review. Never
 * defaults to today's date.
 */
export function parseFlexibleDate(raw: string): DateParseResult {
  const value = raw.trim();
  if (!value) return { date: null, reason: "값이 비어 있음", ambiguous: false };

  const iso = ISO_RE.exec(value);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidYmd(year, month, day)) {
      return { date: null, reason: `${year}-${pad2(month)}-${pad2(day)}는 존재하지 않는 날짜`, ambiguous: false };
    }
    return { date: `${year}-${pad2(month)}-${pad2(day)}`, reason: null, ambiguous: false };
  }

  const compact = YYYYMMDD_RE.exec(value);
  if (compact) {
    const year = Number(compact[1]);
    const month = Number(compact[2]);
    const day = Number(compact[3]);
    if (!isValidYmd(year, month, day)) {
      return { date: null, reason: `${value}는 존재하지 않는 날짜(YYYYMMDD)`, ambiguous: false };
    }
    return { date: `${year}-${pad2(month)}-${pad2(day)}`, reason: null, ambiguous: false };
  }

  const korean = KOREAN_DATE_RE.exec(value);
  if (korean) {
    const year = Number(korean[1]);
    const month = Number(korean[2]);
    const day = Number(korean[3]);
    if (!isValidYmd(year, month, day)) {
      return { date: null, reason: `${value}는 존재하지 않는 날짜`, ambiguous: false };
    }
    return { date: `${year}-${pad2(month)}-${pad2(day)}`, reason: null, ambiguous: false };
  }

  const slash = SLASH_DMY_RE.exec(value);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const year = Number(slash[3]);
    const aCouldBeMonth = a >= 1 && a <= 12;
    const bCouldBeMonth = b >= 1 && b <= 12;
    if (aCouldBeMonth && bCouldBeMonth) {
      // Both readings (M/D and D/M) are plausible in isolation — defer to resolveDateColumn.
      return { date: null, reason: null, ambiguous: true };
    }
    // Unambiguous: whichever of a/b is ≤ 12 is the month, the other is the day.
    const month = aCouldBeMonth ? a : b;
    const day = aCouldBeMonth ? b : a;
    if (!isValidYmd(year, month, day)) {
      return { date: null, reason: `${value}는 존재하지 않는 날짜`, ambiguous: false };
    }
    return { date: `${year}-${pad2(month)}-${pad2(day)}`, reason: null, ambiguous: false };
  }

  // Excel/Sheets date serial: a bare integer/decimal, no separators at all.
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = fromExcelSerial(Number(value));
    if (serial) return { date: serial, reason: null, ambiguous: false };
    return { date: null, reason: `숫자 값이지만 유효한 날짜 일련번호가 아님 ("${value}")`, ambiguous: false };
  }

  return { date: null, reason: `인식할 수 없는 날짜 형식 ("${value}")`, ambiguous: false };
}

/**
 * Resolves an entire date column at once so DD/MM vs MM/DD is decided
 * consistently across the file, not row by row: if any value in the column
 * has a component > 12 in a fixed slash position, that position is the day
 * and the whole column is re-parsed under that assumption. If every value
 * is genuinely ambiguous (every row's day/month could be either), each
 * ambiguous row is returned as unresolved for manual review — never guessed.
 */
export function resolveDateColumn(rawValues: string[]): Map<string, DateParseResult> {
  const results = new Map<string, DateParseResult>();
  const ambiguousRaw: string[] = [];

  for (const raw of rawValues) {
    if (results.has(raw)) continue;
    const result = parseFlexibleDate(raw);
    if (result.ambiguous) {
      ambiguousRaw.push(raw);
    } else {
      results.set(raw, result);
    }
  }

  if (ambiguousRaw.length === 0) return results;

  // Look for a disambiguating row anywhere in the column (ambiguous or not):
  // one whose first slash component is > 12 (must be the day → D/M/Y) or
  // whose second component is > 12 (must be the day → M/D/Y).
  let order: "DMY" | "MDY" | null = null;
  for (const raw of rawValues) {
    const m = SLASH_DMY_RE.exec(raw.trim());
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) {
      order = "DMY";
      break;
    }
    if (b > 12 && a <= 12) {
      order = "MDY";
      break;
    }
  }

  for (const raw of ambiguousRaw) {
    const m = SLASH_DMY_RE.exec(raw.trim());
    if (!m || !order) {
      results.set(raw, {
        date: null,
        reason: `MM/DD와 DD/MM을 구분할 수 없음 ("${raw}") — 파일 전체에서 순서를 판단할 단서가 없음`,
        ambiguous: true,
      });
      continue;
    }
    const day = order === "DMY" ? Number(m[1]) : Number(m[2]);
    const month = order === "DMY" ? Number(m[2]) : Number(m[1]);
    const year = Number(m[3]);
    if (!isValidYmd(year, month, day)) {
      results.set(raw, { date: null, reason: `${raw}는 존재하지 않는 날짜`, ambiguous: false });
    } else {
      results.set(raw, { date: `${year}-${pad2(month)}-${pad2(day)}`, reason: null, ambiguous: false });
    }
  }

  return results;
}
