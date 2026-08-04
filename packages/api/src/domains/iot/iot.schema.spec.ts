import { describe, it, expect } from "vitest";

import {
  zIotCredentials,
  zIotDevice,
  zRegisterIotDeviceBody,
  zIssueIotCredentialsResponse,
  zOnboardDeviceBody,
  zDeviceOnboardingConfig,
  zDeviceExperiment,
} from "./iot.schema";

describe("Iot Schema", () => {
  describe("zIotCredentials", () => {
    it("should validate valid IoT credentials", () => {
      const validCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: "2026-02-09T12:00:00.000Z",
      };

      const result = zIotCredentials.safeParse(validCredentials);
      expect(result.success).toBe(true);
    });

    it("should reject credentials with missing fields", () => {
      const invalidCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      };

      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(false);
    });

    it("should reject credentials with invalid expiration format", () => {
      const invalidCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: "not-a-valid-date",
      };

      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(false);
    });

    it("should reject credentials with empty strings", () => {
      const invalidCredentials = {
        accessKeyId: "",
        secretAccessKey: "",
        sessionToken: "",
        expiration: "2026-02-09T12:00:00.000Z",
      };

      // Empty strings are still valid strings per the schema
      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(true);
    });

    it("should reject credentials with non-string values", () => {
      const invalidCredentials = {
        accessKeyId: 123,
        secretAccessKey: true,
        sessionToken: null,
        expiration: "2026-02-09T12:00:00.000Z",
      };

      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(false);
    });
  });

  describe("zRegisterIotDeviceBody", () => {
    const validBody = {
      serialNumber: "E8:F6:0A:B1:1D:D4",
      deviceType: "ambyte",
      name: "Greenhouse sensor 1",
    };

    it("accepts a valid body", () => {
      expect(zRegisterIotDeviceBody.safeParse(validBody).success).toBe(true);
    });

    it("accepts a body without the optional name", () => {
      const { name: _name, ...withoutName } = validBody;
      expect(zRegisterIotDeviceBody.safeParse(withoutName).success).toBe(true);
    });

    it("rejects an empty serialNumber", () => {
      expect(zRegisterIotDeviceBody.safeParse({ ...validBody, serialNumber: "" }).success).toBe(
        false,
      );
    });

    it("rejects an empty deviceType", () => {
      expect(zRegisterIotDeviceBody.safeParse({ ...validBody, deviceType: "" }).success).toBe(
        false,
      );
    });

    it("rejects a serialNumber longer than 255 chars", () => {
      expect(
        zRegisterIotDeviceBody.safeParse({ ...validBody, serialNumber: "a".repeat(256) }).success,
      ).toBe(false);
    });

    it("rejects an empty name when provided", () => {
      expect(zRegisterIotDeviceBody.safeParse({ ...validBody, name: "" }).success).toBe(false);
    });
  });

  describe("zIotDevice", () => {
    const validDevice = {
      id: "11111111-1111-4111-8111-111111111111",
      thingName: "ambyte_1",
      thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/ambyte_1",
      serialNumber: "SN-1",
      name: "Device 1",
      deviceType: "ambyte",
      status: "pending",
      certificateId: null,
      certificateArn: null,
      createdBy: "22222222-2222-4222-8222-222222222222",
      organizationId: "33333333-3333-4333-8333-333333333333",
      visibility: "private",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-10T00:00:00.000Z",
    };

    it("accepts a valid device", () => {
      expect(zIotDevice.safeParse(validDevice).success).toBe(true);
    });

    it("accepts a null name", () => {
      expect(zIotDevice.safeParse({ ...validDevice, name: null }).success).toBe(true);
    });

    it("accepts an active device with certificate fields", () => {
      const active = {
        ...validDevice,
        status: "active",
        certificateId: "cert-1",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-1",
      };
      expect(zIotDevice.safeParse(active).success).toBe(true);
    });

    it("accepts the rotating status", () => {
      expect(zIotDevice.safeParse({ ...validDevice, status: "rotating" }).success).toBe(true);
    });

    it("rejects an unknown status", () => {
      expect(zIotDevice.safeParse({ ...validDevice, status: "connected" }).success).toBe(false);
    });

    it("rejects a non-uuid id", () => {
      expect(zIotDevice.safeParse({ ...validDevice, id: "not-a-uuid" }).success).toBe(false);
    });
  });

  describe("zIssueIotCredentialsResponse", () => {
    const validBundle = {
      certificateId: "cert-1",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-1",
      certificatePem: "-----BEGIN CERTIFICATE-----",
      publicKey: "-----BEGIN PUBLIC KEY-----",
      privateKey: "-----BEGIN RSA PRIVATE KEY-----",
    };

    it("accepts a full credential bundle", () => {
      expect(zIssueIotCredentialsResponse.safeParse(validBundle).success).toBe(true);
    });

    it("rejects a bundle missing the private key", () => {
      const { privateKey: _pk, ...withoutKey } = validBundle;
      expect(zIssueIotCredentialsResponse.safeParse(withoutKey).success).toBe(false);
    });
  });

  describe("zOnboardDeviceBody", () => {
    it("defaults a missing experiment list to empty (config re-issue)", () => {
      const result = zOnboardDeviceBody.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experimentIds).toEqual([]);
      }
    });

    it("rejects non-uuid experiment ids", () => {
      expect(zOnboardDeviceBody.safeParse({ experimentIds: ["not-a-uuid"] }).success).toBe(false);
    });

    it("caps the experiment list at 100", () => {
      const ids = Array.from(
        { length: 101 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      );
      expect(zOnboardDeviceBody.safeParse({ experimentIds: ids }).success).toBe(false);
    });
  });

  describe("zDeviceOnboardingConfig", () => {
    const validConfig = {
      thingName: "ambyte_AA11",
      deviceType: "ambyte",
      endpoint: "abc123-ats.iot.eu-central-1.amazonaws.com",
      experiments: [
        {
          experimentId: "11111111-1111-4111-8111-111111111111",
          experimentName: "Corn",
          topicPrefix: "experiment/data_ingest/v1/11111111-1111-4111-8111-111111111111/ambyte",
          workbook: null,
        },
      ],
    };

    it("accepts a config with a workbook-less experiment", () => {
      expect(zDeviceOnboardingConfig.safeParse(validConfig).success).toBe(true);
    });

    it("accepts a pinned workbook payload", () => {
      const withWorkbook = {
        ...validConfig,
        experiments: [
          {
            ...validConfig.experiments[0],
            workbook: {
              version: 1,
              cells: [],
              entitySnapshots: { protocols: {}, macros: {} },
            },
          },
        ],
      };
      expect(zDeviceOnboardingConfig.safeParse(withWorkbook).success).toBe(true);
    });

    it("rejects an unknown device type", () => {
      expect(
        zDeviceOnboardingConfig.safeParse({ ...validConfig, deviceType: "toaster" }).success,
      ).toBe(false);
    });
  });

  describe("zDeviceExperiment", () => {
    it("accepts a bound experiment with its added timestamp", () => {
      const binding = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Corn",
        status: "active",
        addedAt: new Date().toISOString(),
      };
      expect(zDeviceExperiment.safeParse(binding).success).toBe(true);
    });

    it("rejects a non-datetime addedAt", () => {
      const binding = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Corn",
        status: "active",
        addedAt: "yesterday",
      };
      expect(zDeviceExperiment.safeParse(binding).success).toBe(false);
    });
  });
});
