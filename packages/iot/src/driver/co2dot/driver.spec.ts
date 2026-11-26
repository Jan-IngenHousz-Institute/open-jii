import { describe, expect, it } from "vitest";

import { GenericCommandConnector } from "../generic/command-connector";
import { Co2DotDriver } from "./driver";

describe("Co2DotDriver", () => {
  it("speaks the raw console under the co2dot family", async () => {
    const driver = new Co2DotDriver();
    expect(driver).toBeInstanceOf(GenericCommandConnector);
    expect(driver.family).toBe("co2dot");
    await expect(driver.getDeviceIdentity()).resolves.toEqual({ family: "co2dot", raw: {} });
  });
});
