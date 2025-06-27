import { UnauthorizedException, InternalServerErrorException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { ApiKeyGuard } from "./api-key.guard";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    let mockContext: ExecutionContext;
    let mockRequest: { headers: Record<string, string> };

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };
      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;
    });

    it("should return true when API key is valid", () => {
      // Arrange
      const validApiKey = "valid-api-key";
      mockRequest.headers["x-api-key"] = validApiKey;
      const getOrThrowSpy = jest.spyOn(configService, "getOrThrow").mockReturnValue(validApiKey);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(getOrThrowSpy).toHaveBeenCalledWith("databricks.webhookApiKey");
    });

    it("should throw UnauthorizedException when API key is missing", () => {
      // Arrange
      const validApiKey = "valid-api-key";

      // No API key in headers
      const getOrThrowSpy = jest.spyOn(configService, "getOrThrow").mockReturnValue(validApiKey);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(getOrThrowSpy).toHaveBeenCalledWith("databricks.webhookApiKey");
    });

    it("should throw UnauthorizedException when API key is invalid", () => {
      // Arrange
      const validApiKey = "valid-api-key";
      mockRequest.headers["x-api-key"] = "invalid-api-key";
      const getOrThrowSpy = jest.spyOn(configService, "getOrThrow").mockReturnValue(validApiKey);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(getOrThrowSpy).toHaveBeenCalledWith("databricks.webhookApiKey");
    });

    it("should throw InternalServerErrorException when getOrThrow throws", () => {
      // Arrange
      mockRequest.headers["x-api-key"] = "some-api-key";
      const getOrThrowSpy = jest.spyOn(configService, "getOrThrow").mockImplementation(() => {
        throw new Error("Config not found");
      });

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(InternalServerErrorException);
      expect(getOrThrowSpy).toHaveBeenCalledWith("databricks.webhookApiKey");
    });
  });
});
