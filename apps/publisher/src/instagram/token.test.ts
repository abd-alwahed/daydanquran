import { describe, expect, it } from "vitest";
import { instagramToken } from "./token";
import { memoryLedger } from "./fakes";

const DAY = 24 * 3_600_000;
const NOW = new Date("2026-10-23T04:01:00Z");

function fakeRefresh(answer: "ok" | "refused" = "ok") {
  const refreshed: string[] = [];
  let next = 0;
  const fetchImpl = (async (url: string) => {
    const token = new URL(url).searchParams.get("access_token")!;
    refreshed.push(token);
    if (answer === "refused") return Response.json({ error: { message: "token too new" } }, { status: 400 });
    return Response.json({ access_token: `${token}-r${++next}`, token_type: "bearer", expires_in: 5_184_000 });
  }) as typeof fetch;
  return { fetchImpl, refreshed };
}

describe("instagramToken", () => {
  it("is null without a secret", async () => {
    expect(await instagramToken(memoryLedger(), undefined, NOW)).toBeNull();
  });

  it("refreshes a new secret and keeps the refreshed token in KV", async () => {
    const store = memoryLedger();
    const api = fakeRefresh();
    expect(await instagramToken(store, " seed\n", NOW, api.fetchImpl)).toEqual({ token: "seed-r1" });
    expect(api.refreshed).toEqual(["seed"]);
    expect(await instagramToken(store, "seed", new Date(NOW.getTime() + DAY), api.fetchImpl)).toEqual({ token: "seed-r1" });
    expect(api.refreshed).toHaveLength(1);
  });

  it("refreshes again after a week, from the stored token", async () => {
    const store = memoryLedger();
    const api = fakeRefresh();
    await instagramToken(store, "seed", NOW, api.fetchImpl);
    expect(await instagramToken(store, "seed", new Date(NOW.getTime() + 8 * DAY), api.fetchImpl)).toEqual({ token: "seed-r1-r2" });
  });

  it("uses a newly put secret instead of the stored token", async () => {
    const store = memoryLedger();
    const api = fakeRefresh();
    await instagramToken(store, "old", NOW, api.fetchImpl);
    expect(await instagramToken(store, "new", new Date(NOW.getTime() + DAY), api.fetchImpl)).toEqual({ token: "new-r2" });
  });

  it("keeps publishing with the current token when the refresh is refused, and warns without the token", async () => {
    const result = await instagramToken(memoryLedger(), "seed", NOW, fakeRefresh("refused").fetchImpl);
    expect(result?.token).toBe("seed");
    expect(result?.warning).toContain("token too new");
    expect(result?.warning).not.toContain("seed");
  });
});
