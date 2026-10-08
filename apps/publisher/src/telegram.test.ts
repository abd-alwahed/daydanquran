import { describe, expect, it } from "vitest";
import { TelegramClient } from "./telegram";

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
    const client = new TelegramClient("TOKEN", strictFetch(calls));
    await client.sendMediaGroup("@channel", [{ type: "photo", media: "https://example.com/a.png" }]);
    await client.sendMessage("admin", "hi");
    expect(calls).toEqual([
      "https://api.telegram.org/botTOKEN/sendMediaGroup",
      "https://api.telegram.org/botTOKEN/sendMessage",
    ]);
  });

  it("surfaces Telegram's error description", async () => {
    const failing = (async () => Response.json({ ok: false, description: "chat not found" })) as unknown as typeof fetch;
    await expect(new TelegramClient("TOKEN", failing).sendMessage("x", "y")).rejects.toThrow("chat not found");
  });
});
