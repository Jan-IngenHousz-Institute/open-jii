import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import * as authExpress from "@repo/auth/express";

import { AuthGuard } from "./auth.guard";

describe("AuthGuard", () => {
  let authGuard: AuthGuard;
  let mockGetSession: jest.SpyInstance;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuthGuard],
    }).compile();

    authGuard = moduleRef.get<AuthGuard>(AuthGuard);

    // Mock the getSession function from @repo/auth/express
    mockGetSession = jest.spyOn(authExpress, "getSession") as jest.SpyInstance;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should be defined", () => {
    expect(authGuard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should return true when a valid session exists", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
      };
      const mockRequest = { user: null };
      const mockHttpContext = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
      } as unknown as ExecutionContext;

      // Mock the session to return a valid session
      mockGetSession.mockResolvedValue({ user: mockUser });

      // Act
      const result = await authGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockGetSession).toHaveBeenCalledWith(mockRequest);
    });

    it("should throw UnauthorizedException when no session exists", async () => {
      // Arrange
      const mockRequest = {};
      const mockHttpContext = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
      } as unknown as ExecutionContext;

      // Mock the session to return null (no session)
      mockGetSession.mockResolvedValue(null);

      // Act & Assert
      await expect(authGuard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("Unauthorized"),
      );
      expect(mockGetSession).toHaveBeenCalledWith(mockRequest);
    });
  });
});
