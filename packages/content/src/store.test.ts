import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextToReview, pageRange, readApprovedPages, setPageApproval, withApproval } from "./store";

describe("withApproval", () => {
  it("adds a page once and keeps the list ascending", () => {
    expect(withApproval([3, 1], 2, true)).toEqual([1, 2, 3]);
    expect(withApproval([1, 2], 2, true)).toEqual([1, 2]);
  });

  it("removes a withdrawn page", () => {
    expect(withApproval([1, 2, 3], 2, false)).toEqual([1, 3]);
    expect(withApproval([1, 3], 2, false)).toEqual([1, 3]);
  });

  it("rejects page numbers outside the mushaf", () => {
    for (const page of [0, 605, 1.5, Number.NaN]) expect(() => withApproval([], page, true)).toThrow();
    expect(() => withApproval([1], [2, 605], true)).toThrow();
  });

  it("approves or withdraws several pages at once", () => {
    expect(withApproval([1, 5], [2, 3, 5], true)).toEqual([1, 2, 3, 5]);
    expect(withApproval([1, 2, 3, 5], [2, 3, 4], false)).toEqual([1, 5]);
  });
});

describe("pageRange", () => {
  it("is inclusive at both ends", () => {
    expect(pageRange(8, 11)).toEqual([8, 9, 10, 11]);
    expect(pageRange(604, 604)).toEqual([604]);
  });

  it("rejects reversed or out-of-mushaf ranges", () => {
    expect(() => pageRange(30, 8)).toThrow();
    expect(() => pageRange(0, 5)).toThrow();
    expect(() => pageRange(600, 605)).toThrow();
  });
});

describe("nextToReview", () => {
  const built = [1, 2, 3, 4, 5, 6];

  it("returns the first unapproved built page", () => {
    expect(nextToReview(built, [1, 2, 4])).toBe(3);
  });

  it("continues after a skipped page", () => {
    expect(nextToReview(built, [1, 2, 4], 3)).toBe(5);
  });

  it("ignores pages that are not built and ends when everything after is approved", () => {
    expect(nextToReview([1, 2, 10], [1, 2])).toBe(10);
    expect(nextToReview(built, [5, 6], 4)).toBeUndefined();
  });
});

describe("setPageApproval", () => {
  let file: string;

  beforeEach(async () => {
    file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "daydan-approved-")), "approved.json");
    await fs.writeFile(file, JSON.stringify({ note: "ملاحظة", pages: [1, 2] }));
  });

  afterEach(() => fs.rm(path.dirname(file), { recursive: true, force: true }));

  it("writes the decision and keeps the note", async () => {
    await setPageApproval(4, true, file);
    expect(await readApprovedPages(file)).toEqual([1, 2, 4]);
    await setPageApproval(1, false, file);
    expect(await readApprovedPages(file)).toEqual([2, 4]);
    await setPageApproval(pageRange(5, 7), true, file);
    expect(await readApprovedPages(file)).toEqual([2, 4, 5, 6, 7]);
    await setPageApproval([5, 6, 7], false, file);
    expect(await fs.readFile(file, "utf8")).toBe('{\n  "note": "ملاحظة",\n  "pages": [2, 4]\n}\n');
  });
});
