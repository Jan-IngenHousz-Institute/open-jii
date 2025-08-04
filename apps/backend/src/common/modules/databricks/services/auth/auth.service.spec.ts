import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "./auth.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksAuthService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    authService = testApp.module.get(DatabricksAuthService);
    authService.clearTokenCache();

    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getAccessToken", () => {
    it("should successfully obtain an access token", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Execute get access token
      const result = await authService.getAccessToken();

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(MOCK_ACCESS_TOKEN);
    });

    it("should handle authentication errors", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute get access token
      const result = await authService.getAccessToken();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(
        "Databricks token request: HTTP 401: Invalid client credentials",
      );
    });

    it("should cache the token and not request a new one if it's still valid", async () => {
      // First token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Execute first token request
      const result1 = await authService.getAccessToken();
      expect(result1.isSuccess()).toBe(true);

      // Second token request should NOT be made - capturing to ensure it's not called
      const tokenNock2 = nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(200, {
          access_token: "new-token",
          expires_in: MOCK_EXPIRES_IN,
          token_type: "Bearer",
        });

      // Execute second token request - should use cached token
      const result2 = await authService.getAccessToken();
      expect(result2.isSuccess()).toBe(true);
      assertSuccess(result2);
      expect(result2.value).toEqual(MOCK_ACCESS_TOKEN);

      // Second token request should not have been made
      expect(tokenNock2.isDone()).toBe(false);
    });

    it("should handle invalid token responses", async () => {
      // Mock token request with invalid response (missing access_token)
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Execute get access token
      const result = await authService.getAccessToken();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid token response");
    });

    it("should handle network errors during token request", async () => {
      // Mock token request with network error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .replyWithError("Network error");

      // Execute get access token
      const result = await authService.getAccessToken();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Databricks token request: Network error");
    });
  });
});
