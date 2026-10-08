import { describe, expect, it } from "vitest";
import { TelegramClient, describeTokenProblem } from "./telegram";

const TOKEN = "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Behaves like the Workers runtime: fails unless called as a plain function. */
function strictFetch(calls: string[]): typeof fetch {
  return function (this: unknown, input: RequestInfo | URL) {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    calls.push(String(input));
    return Promise.resolve(Response.json({ ok: true, result: [] }));
  } as typeof fetch;
}

describe("TelegramClient", () => {
  it("calls fetch the way the Workers runtime requires", async () => {
    const calls: string[] = [];
    const client = new TelegramClient(TOKEN, strictFetch(calls));
    await client.sendMediaGroup("@channel", [{ type: "photo", media: "https://example.com/a.png" }]);
    await client.sendMessage("admin", "hi");
    expect(calls).toEqual([
      `https://api.telegram.org/bot${TOKEN}/sendMediaGroup`,
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    ]);
  });

  it("surfaces Telegram's error description", async () => {
    const failing = (async () => Response.json({ ok: false, description: "chat not found" })) as unknown as typeof fetch;
    await expect(new TelegramClient(TOKEN, failing).sendMessage("x", "y")).rejects.toThrow("chat not found");
  });

  it("says plainly when the token is wrong", async () => {
    const notFound = (async () => Response.json({ ok: false, description: "Not Found" }, { status: 404 })) as unknown as typeof fetch;
    await expect(new TelegramClient(TOKEN, notFound).sendMessage("x", "y")).rejects.toThrow("توكن البوت غير صالح");
  });

  it("rejects a missing or malformed token without printing it", () => {
    expect(describeTokenProblem(undefined)).toContain("غير موجود");
    expect(describeTokenProblem("bot123")).toContain("طوله 6");
    expect(describeTokenProblem(TOKEN)).toBeNull();
  });
});
