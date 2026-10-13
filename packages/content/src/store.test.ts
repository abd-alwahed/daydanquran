import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readApprovedPages, setPageApproval, withApproval } from "./store";

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
    expect(await fs.readFile(file, "utf8")).toBe('{\n  "note": "ملاحظة",\n  "pages": [2, 4]\n}\n');
  });
});
