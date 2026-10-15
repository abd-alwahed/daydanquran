import { describe, expect, it } from "vitest";
import { SCHEDULED_MAX, bufferPosts, meccaDate, meccaToUtc, planActions, sameText } from "./buffer";
import { PLAN } from "./plan";

const posts = bufferPosts(PLAN, "https://site/marketing");
const before = new Date("2026-10-16T00:00:00Z");

describe("Buffer posts from the plan", () => {
  it("converts Mecca times to UTC", () => {
    expect(meccaToUtc("2026-10-17", "٢٠:٣٠")).toBe("2026-10-17T17:30:00.000Z");
    expect(meccaToUtc("2026-10-23", "٠٩:٠٠")).toBe("2026-10-23T06:00:00.000Z");
  });

  it("takes only feed posts, never stories", () => {
    for (const p of posts) for (const url of p.images) expect(url).not.toMatch(/story|countdown/);
    expect(posts.find((p) => p.date === "2026-10-21")!.images).toHaveLength(6);
  });

  it("keeps carousel images in order on the public site", () => {
    expect(posts.find((p) => p.date === "2026-10-17")!.images[0]).toBe(
      "https://site/marketing/2026-10-17/what-1.png",
    );
  });

  it("marks the quotes for review", () => {
    expect(posts.filter((p) => p.needsReview).map((p) => p.date)).toEqual([
      "2026-10-19",
      "2026-10-28",
      "2026-11-11",
      "2026-11-18",
    ]);
  });
});

describe("what to do on a channel", () => {
  it("schedules up to the free plan's limit, then saves drafts", () => {
    const actions = planActions(posts, [], before);
    expect(actions.filter((a) => a.action === "schedule")).toHaveLength(SCHEDULED_MAX);
    expect(actions.filter((a) => a.action === "draft")).toHaveLength(posts.length - SCHEDULED_MAX);
  });

  it("only drafts the quotes, even with room left", () => {
    const actions = planActions(posts, [], before);
    for (const a of actions) if (a.post.needsReview) expect(a.action).toBe("draft");
  });

  it("skips what Buffer already has and counts its scheduled posts", () => {
    const existing = [
      { text: `  ${posts[0]!.text.replace(/\n/g, "\n\n")} `, status: "scheduled" },
      { text: posts[1]!.text, status: "draft" },
    ];
    const actions = planActions(posts, existing, before);
    expect(actions.slice(0, 2).map((a) => a.action)).toEqual(["skip-exists", "skip-exists"]);
    expect(actions.filter((a) => a.action === "schedule")).toHaveLength(SCHEDULED_MAX - 1);
  });

  it("tells the Friday posts apart by date, since they share a caption", () => {
    const fridays = posts.filter((p) => p.title.startsWith("جمعة"));
    const existing = [{ text: fridays[0]!.text, status: "draft", dueAt: "2026-10-30T11:00:00Z" }];
    const actions = planActions(fridays, existing, before);
    expect(actions.map((a) => a.action)).toEqual(["skip-exists", "schedule", "schedule", "schedule"]);
  });

  it("dates Buffer posts in Mecca time", () => {
    expect(meccaDate("2026-10-29T21:30:00Z")).toBe("2026-10-30");
    expect(meccaDate("2026-10-30T20:59:00Z")).toBe("2026-10-30");
  });

  it("does not schedule what is already past", () => {
    const actions = planActions(posts, [], new Date("2026-10-18T00:00:00Z"));
    expect(actions.filter((a) => a.post.date < "2026-10-18").every((a) => a.action === "skip-past")).toBe(
      true,
    );
  });

  it("matches captions regardless of spacing", () => {
    expect(sameText("a\n\nb ", "a b")).toBe(true);
    expect(sameText("a", "b")).toBe(false);
  });
});
