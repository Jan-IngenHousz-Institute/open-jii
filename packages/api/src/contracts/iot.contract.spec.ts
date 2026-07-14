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

  describe("device registry endpoints", () => {
    it("defines listIotDevices as GET /api/v1/devices", () => {
      expect(iotContract.listIotDevices.method).toBe("GET");
      expect(iotContract.listIotDevices.path).toBe("/api/v1/devices");
    });

    it("defines registerIotDevice as POST /api/v1/devices with a body", () => {
      expect(iotContract.registerIotDevice.method).toBe("POST");
      expect(iotContract.registerIotDevice.path).toBe("/api/v1/devices");
      expect(iotContract.registerIotDevice.body).toBeDefined();
      expect(iotContract.registerIotDevice.responses[201]).toBeDefined();
    });

    it("defines getIotDevice as GET /api/v1/devices/:deviceId", () => {
      expect(iotContract.getIotDevice.method).toBe("GET");
      expect(iotContract.getIotDevice.path).toBe("/api/v1/devices/:deviceId");
      expect(iotContract.getIotDevice.responses[404]).toBeDefined();
    });

    it("defines deleteIotDevice as DELETE /api/v1/devices/:deviceId returning 204", () => {
      expect(iotContract.deleteIotDevice.method).toBe("DELETE");
      expect(iotContract.deleteIotDevice.path).toBe("/api/v1/devices/:deviceId");
      expect(iotContract.deleteIotDevice.responses[204]).toBeNull();
    });
  });

  describe("credential endpoints", () => {
    it("defines issueIotCredentials as POST /api/v1/devices/:deviceId/credentials", () => {
      expect(iotContract.issueIotCredentials.method).toBe("POST");
      expect(iotContract.issueIotCredentials.path).toBe("/api/v1/devices/:deviceId/credentials");
      expect(iotContract.issueIotCredentials.responses[201]).toBeDefined();
    });

    it("defines rotateIotCredentials as POST /api/v1/devices/:deviceId/credentials/rotate", () => {
      expect(iotContract.rotateIotCredentials.method).toBe("POST");
      expect(iotContract.rotateIotCredentials.path).toBe(
        "/api/v1/devices/:deviceId/credentials/rotate",
      );
      expect(iotContract.rotateIotCredentials.responses[201]).toBeDefined();
    });

    it("defines revokeIotCredentials as DELETE /api/v1/devices/:deviceId/credentials", () => {
      expect(iotContract.revokeIotCredentials.method).toBe("DELETE");
      expect(iotContract.revokeIotCredentials.path).toBe("/api/v1/devices/:deviceId/credentials");
      expect(iotContract.revokeIotCredentials.responses[200]).toBeDefined();
    });
  });
});
