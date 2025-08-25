import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import * as crypto from "crypto";

import { stableStringify } from "../utils/stable-json";
import { HmacGuard } from "./hmac.guard";

describe("HmacGuard", () => {
  let guard: HmacGuard;
  let configService: ConfigService;

  const mockApiKeyId = "test-key-id";
  const mockApiKey = "test-api-key";
  const mockWebhookSecret = "test-webhook-secret";
  const mockTimestamp = Math.floor(Date.now() / 1000).toString();
  const mockBody = { experimentId: "exp-123", status: "RUNNING" };
  const mockBodyString = JSON.stringify(mockBody);

  beforeEach(async () => {
    // Create mock configService
    const configServiceMock = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "databricks.webhookApiKeys") return { [mockApiKeyId]: mockApiKey };
        if (key === "databricks.webhookSecret") return mockWebhookSecret;
        throw new Error(`Unexpected key: ${key}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HmacGuard,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    guard = module.get<HmacGuard>(HmacGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should pass validation with valid signature", () => {
    // Create spy before the call
    const getOrThrowMethod = vi.spyOn(configService, "getOrThrow");

    // Create a valid signature
    const payload = `${mockTimestamp}:${mockBodyString}`;
    const signature = crypto.createHmac("sha256", mockWebhookSecret).update(payload).digest("hex");

    // Mock the execution context
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-signature": signature,
            "x-databricks-timestamp": mockTimestamp,
          },
          body: mockBody,
        }),
      }),
    } as ExecutionContext;

    // Expect the guard to pass (canActivate returns boolean, not Promise)
    expect(guard.canActivate(mockContext)).toBe(true);

    // Verify the configService was called with the expected keys
    expect(getOrThrowMethod).toHaveBeenCalledWith("databricks.webhookApiKeys");
    expect(getOrThrowMethod).toHaveBeenCalledWith("databricks.webhookSecret");
  });

  it("should reject with invalid API key ID", () => {
    // Create spy before the call
    const getOrThrowMethod = vi.spyOn(configService, "getOrThrow");

    // Mock the execution context with invalid API key ID
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": "invalid-api-key-id",
            "x-databricks-signature": "some-signature",
            "x-databricks-timestamp": mockTimestamp,
          },
          body: mockBody,
        }),
      }),
    } as ExecutionContext;

    // Expect the guard to throw UnauthorizedException
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    expect(getOrThrowMethod).toHaveBeenCalledWith("databricks.webhookApiKeys");
  });

  it("should reject with invalid signature", () => {
    // Mock the execution context with invalid signature
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-signature": "invalid-signature",
            "x-databricks-timestamp": mockTimestamp,
          },
          body: mockBody,
        }),
      }),
    } as ExecutionContext;

    // Expect the guard to throw UnauthorizedException
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it("should reject with missing signature", () => {
    // Mock the execution context with missing signature
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-timestamp": mockTimestamp,
          },
          body: mockBody,
        }),
      }),
    } as ExecutionContext;

    // Expect the guard to throw UnauthorizedException
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it("should reject with missing timestamp", () => {
    // Create a valid signature without timestamp
    const payload = `${mockTimestamp}:${mockBodyString}`;
    const signature = crypto.createHmac("sha256", mockWebhookSecret).update(payload).digest("hex");

    // Mock the execution context with missing timestamp
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-signature": signature,
          },
          body: mockBody,
        }),
      }),
    } as ExecutionContext;

    // Expect the guard to throw UnauthorizedException
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it("should reject with expired timestamp", () => {
    // Use an old timestamp (10 minutes ago)
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();

    // Create a valid signature with old timestamp
    const payload = `${oldTimestamp}:${mockBodyString}`;
    const signature = crypto.createHmac("sha256", mockWebhookSecret).update(payload).digest("hex");

    // Mock the execution context with old timestamp
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-signature": signature,
            "x-databricks-timestamp": oldTimestamp,
          },
          body: mockBody,
        }),
      }),
    } as ExecutionContext;

    // Expect the guard to throw UnauthorizedException
    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it("should handle different object layouts consistently in signature creation", () => {
    // Setup objects with same data but different property order
    const obj1 = {
      b: 2,
      a: 1,
      c: {
        z: 3,
        y: 2,
        x: 1,
      },
    };

    const obj2 = {
      a: 1,
      b: 2,
      c: {
        x: 1,
        y: 2,
        z: 3,
      },
    };

    // Create contexts with the different objects
    const mockContext1 = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-signature": "test-sig",
            "x-databricks-timestamp": mockTimestamp,
          },
          body: obj1,
        }),
      }),
    } as ExecutionContext;

    const mockContext2 = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key-id": mockApiKeyId,
            "x-databricks-signature": "test-sig",
            "x-databricks-timestamp": mockTimestamp,
          },
          body: obj2,
        }),
      }),
    } as ExecutionContext;

    const result1 = stableStringify(obj1);
    const result2 = stableStringify(obj2);

    // Check that the results are identical
    expect(result1).toBe(result2);

    // Verify that normal JSON would be different
    expect(JSON.stringify(obj1)).not.toBe(JSON.stringify(obj2));

    // Both should throw exceptions when trying to validate with invalid signatures
    expect(() => guard.canActivate(mockContext1)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(mockContext2)).toThrow(UnauthorizedException);
  });
});
