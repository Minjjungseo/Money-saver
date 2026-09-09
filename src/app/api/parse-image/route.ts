import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface RawParsedTransaction {
  date: string | null;
  time: string | null;
  merchant: string | null;
  amount: number | null;
  currency: "AUD" | "KRW" | null;
  direction: "IN" | "OUT" | null;
  status: "PENDING" | "SETTLED" | null;
  balanceAfter: number | null;
  truncated: boolean | null;
  transactionTypeGuess: string | null;
  categoryGuess: string | null;
  subcategoryGuess: string | null;
  confidence: number | null;
}

interface RawParseResponse {
  bankHint: string | null;
  transactions: RawParsedTransaction[];
}

const SYSTEM_PROMPT = `You read a screenshot of a banking app's transaction list (e.g. CommBank, 하나트래블로그/Hana, or similar) or a paper bank statement. Treat it as a LIST of transaction rows stacked vertically, not a single receipt — scan the ENTIRE image from top to bottom and extract every row you can see, not just the first one.

What counts as a transaction row: a single line item showing a specific payment, purchase, transfer, or deposit with its own date/time and amount.

What is NOT a transaction row — never turn these into an entry:
- The account name or account holder's name
- "Current balance" / "Available balance" / total balance shown at the top
- Section date headers like "Today", "Yesterday", "9월6일(일)" that group rows below them (use them to infer the date of the rows under them, but never emit the header itself as a row)
- Buttons, tabs, filters, search icons, navigation labels, promotional banners

For EACH real transaction row, extract:
{
  "date": "YYYY-MM-DD, resolved using any section header above the row (e.g. a header of '9월6일' becomes this year's Sep 6) — or null if genuinely unreadable. Never guess a date; use null instead.",
  "time": "HH:MM exactly as shown (24h), or null if the row has no time shown",
  "merchant": "the merchant/payee/description text exactly as shown, or null if it's cut off / unreadable — do NOT invent a name",
  "amount": "the transaction amount only, as a positive number in major units (e.g. 84.53) — NEVER the balance/running-total number shown after it, and NEVER a time value. If the amount is not fully visible or you are not confident, use null rather than guessing.",
  "currency": "AUD or KRW, guessed from symbols/context; default AUD only if there is truly no signal either way",
  "direction": "OUT if money left the account (a purchase/payment/withdrawal, usually shown with a leading '-'), IN if money was received (salary/transfer/refund/deposit, usually shown with a leading '+' or in a highlighted/green amount)",
  "status": "PENDING if the row is explicitly labeled pending/처리중/미정산, otherwise SETTLED",
  "balanceAfter": "the running account balance shown next to this row AFTER the transaction, as a positive major-unit number, or null if none is shown — this is a separate number from amount, never copy the same value into both",
  "truncated": "true if part of this row (merchant name or amount) is visibly cut off by the edge of the screenshot and not fully readable, else false",
  "transactionTypeGuess": one of "EXPENSE","INCOME","TRANSFER","EXCHANGE","REFUND","CASH_WITHDRAWAL",
  "categoryGuess": best-guess plain-English category name such as "Groceries", "Dining", "Housing", "Car", "Kids", "Shopping", "Health", "Travel", "Entertainment", "Subscriptions", "Business", "Income", "Other",
  "subcategoryGuess": a more specific label if obvious (e.g. "Fuel", "Rent"), else null,
  "confidence": integer 0-100, your confidence in this specific row's accuracy — lower it whenever any field above was uncertain or defaulted to null
}

Common misreads to actively avoid:
- Reading the balance-after column as the transaction amount
- Reading a time value (e.g. "12:31") as an amount
- Dropping the decimal point ("11272" instead of "112.72") or misplacing it ("11.272")
- Concatenating a currency code into the number ("AUD112" instead of amount 112, currency AUD)
- Silently guessing a merchant name or amount that is actually cut off — use null and truncated:true instead

Also identify which bank/app this screenshot is from by its visible branding, colors, or layout (e.g. "CommBank", "하나트래블로그"), and return it as a separate top-level "bankHint" field (exact name if recognizable, else null) — do not guess if there is no visible brand signal.

Return ONLY a JSON object (no prose, no markdown fences) of the shape:
{ "bankHint": string | null, "transactions": [ ...rows as described above... ] }

If the image contains multiple transaction rows, return ALL of them in the transactions array — never stop after the first one. If nothing readable is found, return { "bankHint": null, "transactions": [] }.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ provider: "mock", reason: "no_api_key" });
  }

  try {
    const body = await req.json();
    const { imageBase64, mediaType } = body as { imageBase64: string; mediaType: string };
    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ provider: "mock", reason: "missing_image" });
    }

    const model = process.env.VISION_MODEL || "claude-haiku-4-5-20251001";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              {
                type: "text",
                text: "Scan this entire bank transaction list top to bottom and extract every visible transaction row as described.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ provider: "mock", reason: "api_error", detail: errText.slice(0, 300) });
    }

    const data = await response.json();
    const text: string = data?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "{}";
    const parsed = extractParseResponse(text);

    return NextResponse.json({ provider: "claude-vision", bankHint: parsed.bankHint, transactions: parsed.transactions });
  } catch (err) {
    return NextResponse.json({
      provider: "mock",
      reason: "exception",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Accepts either the requested `{bankHint, transactions}` object or a bare array (older prompt/model behavior), never throwing on a malformed response. */
function extractParseResponse(text: string): RawParseResponse {
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj.transactions)) {
        return { bankHint: typeof obj.bankHint === "string" ? obj.bankHint : null, transactions: obj.transactions };
      }
    } catch {
      // fall through to array-shape handling below
    }
  }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const arr = JSON.parse(arrMatch[0]);
      if (Array.isArray(arr)) return { bankHint: null, transactions: arr };
    } catch {
      // fall through
    }
  }
  return { bankHint: null, transactions: [] };
}
