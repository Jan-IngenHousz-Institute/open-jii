import { createServer } from "http";
import nock from "nock";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { setTimeout as sleep } from "timers/promises";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess, success } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { DatabricksFilesService } from "./files.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;
const MOCK_SCHEMA_NAME = "exp_test_experiment";
const MOCK_CATALOG_NAME = "main";
const MOCK_SOURCE_TYPE = "ambyte";
const MOCK_FILE_NAME = "test-file.csv";
const MOCK_FILE_BUFFER = Buffer.from("test,data,content");

describe("DatabricksFilesService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let filesService: DatabricksFilesService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    filesService = testApp.module.get(DatabricksFilesService);

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

  describe("upload", () => {
    it("should successfully upload a file to a specified path", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload request
      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-imports/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedPath}`)
        .query({ overwrite: "false" })
        .reply(200);

      // Execute upload
      const result = await filesService.upload(expectedPath, MOCK_FILE_BUFFER);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        filePath: expectedPath,
      });
    });

    it("should handle API errors when uploading a file", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload request with error
      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-imports/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedPath}`)
        .query({ overwrite: "false" })
        .reply(500, { error: "Internal Server Error" });

      // Execute upload
      const result = await filesService.upload(expectedPath, MOCK_FILE_BUFFER);

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to upload file to Databricks");
    });

    it("should handle token fetch failure when uploading a file", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-imports/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;

      const result = await filesService.upload(expectedPath, MOCK_FILE_BUFFER);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to upload file to Databricks");
    });

    it("rejects a Buffer body that exceeds the Databricks per-file cap", async () => {
      // Spy on the actual cap so the test stays in sync if it ever changes.
      const cap = DatabricksFilesService.MAX_UPLOAD_BYTES;
      // Allocate a 1-byte buffer and lie about its `length` so we don't actually
      // allocate 5 GiB just to exercise the size-cap branch.
      const fakeOversized = Buffer.alloc(1);
      Object.defineProperty(fakeOversized, "length", { value: cap + 1, configurable: true });

      const result = await filesService.upload("/Volumes/x/y/z/big.csv", fakeOversized);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("exceeds Databricks per-file limit");
    });

    it("lets a slow streamed upload run past the request timeout while bytes keep moving", async () => {
      const timeout = DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT;
      Object.defineProperty(DatabricksConfigService, "DEFAULT_REQUEST_TIMEOUT", { value: 200 });

      try {
        nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
          access_token: MOCK_ACCESS_TOKEN,
          expires_in: MOCK_EXPIRES_IN,
          token_type: "Bearer",
        });
        const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-imports/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;
        nock(databricksHost)
          .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedPath}`)
          .query({ overwrite: "false" })
          .reply(204);

        // Six chunks 100 ms apart: three times the timeout overall, never idle for long.
        async function* slowBody() {
          for (let chunk = 0; chunk < 6; chunk++) {
            await sleep(100);
            yield Buffer.alloc(1024, chunk);
          }
        }

        const result = await filesService.upload(expectedPath, Readable.from(slowBody()));

        assertSuccess(result);
      } finally {
        Object.defineProperty(DatabricksConfigService, "DEFAULT_REQUEST_TIMEOUT", {
          value: timeout,
        });
      }
    });

    it("leaves the rest of a streamed body drainable when the request dies partway", async () => {
      // nock replies only after reading the whole body, so a real socket stands in for Databricks.
      const server = createServer((request) => {
        let received = 0;
        request.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > 256 * 1024) {
            request.socket.destroy();
          }
        });
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("The test server has no port");
      }

      vi.spyOn(testApp.module.get(DatabricksConfigService), "getHost").mockReturnValue(
        `http://127.0.0.1:${address.port}`,
      );
      vi.spyOn(authService, "getAccessToken").mockResolvedValue(success(MOCK_ACCESS_TOKEN));

      try {
        const body = Readable.from(Array.from({ length: 64 }, () => Buffer.alloc(64 * 1024)));

        const result = await filesService.upload("/Volumes/x/y/z/big.bin", body);
        assertFailure(result);

        body.unpipe();
        body.resume();
        await finished(body);
        expect(body.readableEnded).toBe(true);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    // Replaying a body on redirect requires holding all of it in memory.
    it("does not follow a redirect for a streamed upload", async () => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-imports/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedPath}`)
        .query({ overwrite: "false" })
        .reply(307, undefined, { Location: `${databricksHost}/redirected` });
      const redirected = nock(databricksHost).put("/redirected").reply(200);

      const result = await filesService.upload(expectedPath, Readable.from([MOCK_FILE_BUFFER]));

      assertFailure(result);
      expect(redirected.isDone()).toBe(false);
    });
  });
});
