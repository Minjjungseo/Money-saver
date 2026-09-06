import { describe, expect, it } from "vitest";
import { parseFlexibleDate, resolveDateColumn } from "../dateParsing";

describe("parseFlexibleDate", () => {
  it("parses plain ISO yyyy-MM-dd", () => {
    expect(parseFlexibleDate("2026-09-02")).toMatchObject({ date: "2026-09-02" });
  });

  it("parses yyyy/MM/dd and yyyy.MM.dd", () => {
    expect(parseFlexibleDate("2026/09/02")).toMatchObject({ date: "2026-09-02" });
    expect(parseFlexibleDate("2026.09.02")).toMatchObject({ date: "2026-09-02" });
  });

  it("parses an ISO date with an attached time (space or T separated)", () => {
    expect(parseFlexibleDate("2026-09-01 13:42")).toMatchObject({ date: "2026-09-01" });
    expect(parseFlexibleDate("2026-09-01T13:42:00")).toMatchObject({ date: "2026-09-01" });
  });

  it("parses compact YYYYMMDD", () => {
    expect(parseFlexibleDate("20260902")).toMatchObject({ date: "2026-09-02" });
  });

  it("parses Korean-style dates", () => {
    expect(parseFlexibleDate("2026년 9월 1일")).toMatchObject({ date: "2026-09-01" });
    expect(parseFlexibleDate("2026년9월1일")).toMatchObject({ date: "2026-09-01" });
  });

  it("parses an Excel/Sheets date serial number", () => {
    // 46000 -> 2025-12-06 per the standard Excel epoch (1899-12-30 + 46000 days)
    const result = parseFlexibleDate("46000");
    expect(result.date).not.toBeNull();
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("resolves an unambiguous D/M/Y (day > 12) without needing column context", () => {
    expect(parseFlexibleDate("25/03/2026")).toMatchObject({ date: "2026-03-25" });
  });

  it("resolves an unambiguous M/D/Y (second part > 12) without needing column context", () => {
    expect(parseFlexibleDate("03/25/2026")).toMatchObject({ date: "2026-03-25" });
  });

  it("flags a genuinely ambiguous D/M vs M/D value (both parts <= 12) instead of guessing", () => {
    const result = parseFlexibleDate("03/04/2026");
    expect(result.date).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  it("never invents a date for garbage input", () => {
    expect(parseFlexibleDate("")).toMatchObject({ date: null });
    expect(parseFlexibleDate("not a date")).toMatchObject({ date: null });
    expect(parseFlexibleDate("2026-13-40")).toMatchObject({ date: null });
  });
});

describe("resolveDateColumn", () => {
  it("infers D/M/Y for the whole column from one disambiguating row", () => {
    const values = ["03/04/2026", "25/01/2026", "01/02/2026"];
    const results = resolveDateColumn(values);
    // 25/01/2026 proves the file is D/M/Y (25 can't be a month)
    expect(results.get("25/01/2026")?.date).toBe("2026-01-25");
    expect(results.get("03/04/2026")?.date).toBe("2026-04-03");
    expect(results.get("01/02/2026")?.date).toBe("2026-02-01");
  });

  it("infers M/D/Y for the whole column from one disambiguating row", () => {
    const values = ["03/04/2026", "01/25/2026", "02/01/2026"];
    const results = resolveDateColumn(values);
    // 01/25/2026 proves the file is M/D/Y (25 can't be a month)
    expect(results.get("01/25/2026")?.date).toBe("2026-01-25");
    expect(results.get("03/04/2026")?.date).toBe("2026-03-04");
    expect(results.get("02/01/2026")?.date).toBe("2026-02-01");
  });

  it("leaves every row unresolved (never guessed) when the whole column is genuinely ambiguous", () => {
    const values = ["03/04/2026", "01/02/2026", "05/06/2026"];
    const results = resolveDateColumn(values);
    for (const raw of values) {
      expect(results.get(raw)?.date).toBeNull();
      expect(results.get(raw)?.ambiguous).toBe(true);
    }
  });

  it("passes unambiguous ISO/compact dates through unaffected", () => {
    const values = ["2026-09-02", "2026-09-03"];
    const results = resolveDateColumn(values);
    expect(results.get("2026-09-02")?.date).toBe("2026-09-02");
    expect(results.get("2026-09-03")?.date).toBe("2026-09-03");
  });
});
