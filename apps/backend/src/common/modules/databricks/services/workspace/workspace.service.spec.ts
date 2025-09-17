import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksWorkspaceService } from "./workspace.service";
import { WorkspaceObjectFormat, WorkspaceObjectLanguage } from "./workspace.types";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksWorkspaceService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let workspaceService: DatabricksWorkspaceService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    workspaceService = testApp.module.get(DatabricksWorkspaceService);

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

  describe("importWorkspaceObject", () => {
    const mockRequest = {
      content: "cHl0aG9uIGNvZGUgaGVyZQ==", // Base64 encoded "python code here"
      format: WorkspaceObjectFormat.SOURCE,
      language: WorkspaceObjectLanguage.PYTHON,
      overwrite: true,
      path: "/Shared/test-notebook",
    };

    it("should successfully import a workspace object", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace import request
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT)
        .reply(200, {});

      // Execute import
      const result = await workspaceService.importWorkspaceObject(mockRequest);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({});
    });

    it("should use default values when optional parameters are not provided", async () => {
      const minimalRequest = {
        content: "cHl0aG9uIGNvZGUgaGVyZQ==",
        path: "/Shared/test-notebook",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace import request with default values
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT, {
          content: minimalRequest.content,
          format: WorkspaceObjectFormat.SOURCE,
          language: undefined,
          overwrite: false,
          path: minimalRequest.path,
        })
        .reply(200, {});

      // Execute import
      const result = await workspaceService.importWorkspaceObject(minimalRequest);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({});
    });

    it("should handle API errors during workspace import", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace import request with error
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT)
        .reply(400, { message: "Invalid path format" });

      // Execute import
      const result = await workspaceService.importWorkspaceObject(mockRequest);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to import workspace object");
    });

    it("should handle authentication failure during import", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute import
      const result = await workspaceService.importWorkspaceObject(mockRequest);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to import workspace object");
    });
  });

  describe("deleteWorkspaceObject", () => {
    const mockDeleteRequest = {
      path: "/Shared/test-notebook-to-delete",
      recursive: false,
    };

    it("should successfully delete a workspace object", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace delete request
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_DELETE_ENDPOINT)
        .reply(200, {});

      // Execute delete
      const result = await workspaceService.deleteWorkspaceObject(mockDeleteRequest);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({});
    });

    it("should use default recursive value when not provided", async () => {
      const minimalDeleteRequest = {
        path: "/Shared/test-notebook-to-delete",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace delete request with default recursive value
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_DELETE_ENDPOINT, {
          path: minimalDeleteRequest.path,
          recursive: false,
        })
        .reply(200, {});

      // Execute delete
      const result = await workspaceService.deleteWorkspaceObject(minimalDeleteRequest);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({});
    });

    it("should handle API errors during workspace delete", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace delete request with error
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_DELETE_ENDPOINT)
        .reply(404, { message: "Path not found" });

      // Execute delete
      const result = await workspaceService.deleteWorkspaceObject(mockDeleteRequest);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to delete workspace object");
    });

    it("should handle authentication failure during delete", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute delete
      const result = await workspaceService.deleteWorkspaceObject(mockDeleteRequest);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to delete workspace object");
    });
  });
});
