import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/parse-image", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/parse-image", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("falls back to mock when no API key is configured — never calls the network", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(makeRequest({ imageBase64: "abc", mediaType: "image/png" }));
    const json = await res.json();

    expect(json.provider).toBe("mock");
    expect(json.reason).toBe("no_api_key");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to mock when the image payload is missing, even with a key configured", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(json.provider).toBe("mock");
    expect(json.reason).toBe("missing_image");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes through bankHint and transactions from a well-formed Vision API response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                bankHint: "CommBank",
                transactions: [{ date: "2026-09-06", merchant: "Amazon", amount: 125.37 }],
              }),
            },
          ],
        }),
      })
    );

    const res = await POST(makeRequest({ imageBase64: "abc", mediaType: "image/png" }));
    const json = await res.json();

    expect(json.provider).toBe("claude-vision");
    expect(json.bankHint).toBe("CommBank");
    expect(json.transactions).toHaveLength(1);
    expect(json.transactions[0].merchant).toBe("Amazon");
  });

  it("still extracts transactions if the model returns a bare array instead of the requested object shape", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify([{ date: "2026-09-06", merchant: "Amazon", amount: 125.37 }]) }],
        }),
      })
    );

    const res = await POST(makeRequest({ imageBase64: "abc", mediaType: "image/png" }));
    const json = await res.json();

    expect(json.provider).toBe("claude-vision");
    expect(json.transactions).toHaveLength(1);
    expect(json.bankHint).toBeNull();
  });

  it("falls back to mock on a non-ok API response instead of throwing", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "rate limited" })
    );

    const res = await POST(makeRequest({ imageBase64: "abc", mediaType: "image/png" }));
    const json = await res.json();

    expect(json.provider).toBe("mock");
    expect(json.reason).toBe("api_error");
  });
});
