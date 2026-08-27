import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface RawParsedTransaction {
  date: string | null;
  merchant: string | null;
  amount: number | null;
  currency: "AUD" | "KRW" | null;
  direction: "IN" | "OUT" | null;
  transactionTypeGuess: string | null;
  categoryGuess: string | null;
  subcategoryGuess: string | null;
  confidence: number | null;
}

const SYSTEM_PROMPT = `You extract financial transactions from an image of a bank app screenshot, bank statement, or receipt.

Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "date": "YYYY-MM-DD or null if unreadable",
  "merchant": "merchant/payee name",
  "amount": positive number, major units (e.g. 84.53),
  "currency": "AUD" or "KRW" (guess from symbols/context; default AUD if unclear),
  "direction": "OUT" if money left the account (a purchase/payment/withdrawal), "IN" if money was received (salary/transfer/refund),
  "transactionTypeGuess": one of "EXPENSE","INCOME","TRANSFER","EXCHANGE","REFUND","CASH_WITHDRAWAL",
  "categoryGuess": best-guess plain-English category name such as "Groceries", "Dining", "Housing", "Car", "Kids", "Shopping", "Health", "Travel", "Entertainment", "Subscriptions", "Business", "Income", "Other",
  "subcategoryGuess": a more specific label if obvious (e.g. "Fuel", "Rent"), else null,
  "confidence": integer 0-100, your confidence in this row's accuracy
}

If the image contains multiple transaction rows, return all of them. If nothing readable is found, return [].`;

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
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: "Extract every transaction visible in this image as a JSON array." },
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
    const text: string = data?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed: RawParsedTransaction[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ provider: "claude-vision", transactions: parsed });
  } catch (err) {
    return NextResponse.json({
      provider: "mock",
      reason: "exception",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
