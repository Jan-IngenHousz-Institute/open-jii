import { describe, expect, it } from "vitest";

import { fitsServerRender } from "./workbook-query";

describe("fitsServerRender", () => {
  const workbook = (cells: number) => ({
    id: "wb",
    cells: Array.from({ length: cells }, () => ({})),
  });

  it("lets the server render a workbook of up to 100 cells", () => {
    expect(fitsServerRender(workbook(0))).toBe(true);
    expect(fitsServerRender(workbook(100))).toBe(true);
  });

  it("leaves larger workbooks to the browser", () => {
    expect(fitsServerRender(workbook(101))).toBe(false);
    expect(fitsServerRender(workbook(921))).toBe(false);
  });

  it("rejects anything that is not a workbook", () => {
    expect(fitsServerRender(undefined)).toBe(false);
    expect(fitsServerRender({ cells: "many" })).toBe(false);
  });
});
