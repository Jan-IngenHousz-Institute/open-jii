import { describe, it, expect } from "vitest";

import { zIotCredentials } from "../schemas/iot.schema";
import { iotContract } from "./iot.contract";

describe("Iot Contract", () => {
  describe("iotContract", () => {
    it("should define getCredentials endpoint", () => {
      expect(iotContract.getCredentials).toBeDefined();
      expect(iotContract.getCredentials.method).toBe("GET");
      expect(iotContract.getCredentials.path).toBe("/api/v1/iot/credentials");
    });

    it("should have correct response status codes", () => {
      expect(iotContract.getCredentials.responses[200]).toBe(zIotCredentials);
      expect(iotContract.getCredentials.responses[401]).toBeDefined();
      expect(iotContract.getCredentials.responses[500]).toBeDefined();
    });
  });
});
