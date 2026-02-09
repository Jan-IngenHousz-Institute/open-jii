import { describe, it, expect } from "vitest";

import { zIoTCredentials, iotContract } from "./iot.contract";

describe("IoT Contract", () => {
    describe("zIoTCredentials schema", () => {
        it("should validate valid IoT credentials", () => {
            const validCredentials = {
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                sessionToken: "mock-session-token",
                expiration: "2026-02-09T12:00:00.000Z",
            };

            const result = zIoTCredentials.safeParse(validCredentials);
            expect(result.success).toBe(true);
        });

        it("should reject credentials with missing fields", () => {
            const invalidCredentials = {
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                // Missing other required fields
            };

            const result = zIoTCredentials.safeParse(invalidCredentials);
            expect(result.success).toBe(false);
        });

        it("should reject credentials with invalid expiration format", () => {
            const invalidCredentials = {
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                sessionToken: "mock-session-token",
                expiration: "not-a-valid-date",
            };

            const result = zIoTCredentials.safeParse(invalidCredentials);
            expect(result.success).toBe(false);
        });
    });

    describe("iotContract", () => {
        it("should define getCredentials endpoint", () => {
            expect(iotContract.getCredentials).toBeDefined();
            expect(iotContract.getCredentials.method).toBe("POST");
            expect(iotContract.getCredentials.path).toBe("/api/v1/iot/credentials");
        });

        it("should have correct response status codes", () => {
            expect(iotContract.getCredentials.responses[200]).toBe(zIoTCredentials);
            expect(iotContract.getCredentials.responses[401]).toBeDefined();
            expect(iotContract.getCredentials.responses[500]).toBeDefined();
        });
    });
});
