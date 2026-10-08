import { expect, it } from "vitest";
import { fill } from "./template";

it("fills placeholders in order and fails when a template changed", () => {
  expect(fill("[رقم] و [رقم]", "[رقم]", "١", "٢")).toBe("١ و ٢");
  expect(() => fill("[رقم]", "[رقم]", "١", "٢")).toThrow();
});
