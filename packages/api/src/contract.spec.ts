import { describe, it, expect } from "vitest";

import { contract } from "./contract";

describe("API Contract", () => {
  it("should export main contract with all routes", () => {
    expect(contract).toBeDefined();
    expect(contract.experiments).toBeDefined();
    expect(contract.protocols).toBeDefined();
    expect(contract.macros).toBeDefined();
    expect(contract.iot).toBeDefined();
  });

  it("should include IoT contract with getCredentials endpoint", () => {
    expect(contract.iot.getCredentials).toBeDefined();
    expect(contract.iot.getCredentials.method).toBe("GET");
    expect(contract.iot.getCredentials.path).toBe("/api/v1/iot/credentials");
  });
});
