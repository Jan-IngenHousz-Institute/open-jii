import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DeltaSharesService } from "./shares.service";
import type {
  ListSharesResponse,
  GetShareResponse,
  ListSchemasResponse,
  ListTablesResponse,
} from "./shares.types";

describe("DeltaSharesService", () => {
  const testApp = TestHarness.App;
  const deltaEndpoint = process.env.DELTA_ENDPOINT || "https://delta.example.com";

  let sharesService: DeltaSharesService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    sharesService = testApp.module.get(DeltaSharesService);
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listShares", () => {
    it("should successfully list shares", async () => {
      const mockResponse: ListSharesResponse = {
        items: [
          { name: "share1", id: "uuid-1" },
          { name: "share2", id: "uuid-2" },
        ],
      };

      nock(deltaEndpoint).get("/shares").reply(200, mockResponse);

      const result = await sharesService.listShares();

      assertSuccess(result);
      expect(result.value.items).toHaveLength(2);
      expect(result.value.items[0].name).toBe("share1");
    });

    it("should list shares with pagination parameters", async () => {
      const mockResponse: ListSharesResponse = {
        items: [{ name: "share1" }],
        nextPageToken: "next-token",
      };

      nock(deltaEndpoint)
        .get("/shares")
        .query({ maxResults: "10", pageToken: "token123" })
        .reply(200, mockResponse);

      const result = await sharesService.listShares(10, "token123");

      assertSuccess(result);
      expect(result.value.nextPageToken).toBe("next-token");
    });

    it("should handle errors when listing shares fails", async () => {
      nock(deltaEndpoint).get("/shares").reply(500, { error: "Internal server error" });

      const result = await sharesService.listShares();

      assertFailure(result);
      expect(result.error.message).toContain("Failed to list shares");
    });
  });

  describe("getShare", () => {
    it("should successfully get a share", async () => {
      const shareName = "test_share";
      const mockResponse: GetShareResponse = {
        share: { name: shareName, id: "uuid-123" },
      };

      nock(deltaEndpoint).get(`/shares/${shareName}`).reply(200, mockResponse);

      const result = await sharesService.getShare(shareName);

      assertSuccess(result);
      expect(result.value.share.name).toBe(shareName);
    });

    it("should handle share name encoding", async () => {
      const shareName = "share with spaces";
      const encodedName = "share%20with%20spaces";
      const mockResponse: GetShareResponse = {
        share: { name: shareName },
      };

      nock(deltaEndpoint).get(`/shares/${encodedName}`).reply(200, mockResponse);

      const result = await sharesService.getShare(shareName);

      assertSuccess(result);
      expect(result.value.share.name).toBe(shareName);
    });

    it("should handle errors when getting share fails", async () => {
      const shareName = "nonexistent_share";

      nock(deltaEndpoint)
        .get(`/shares/${shareName}`)
        .reply(404, { errorCode: "SHARE_NOT_FOUND", message: "Share not found" });

      const result = await sharesService.getShare(shareName);

      assertFailure(result);
      expect(result.error.message).toContain(`Failed to get share ${shareName}`);
    });
  });

  describe("listSchemas", () => {
    it("should successfully list schemas in a share", async () => {
      const shareName = "test_share";
      const mockResponse: ListSchemasResponse = {
        items: [
          { name: "schema1", share: shareName },
          { name: "schema2", share: shareName },
        ],
      };

      nock(deltaEndpoint).get(`/shares/${shareName}/schemas`).reply(200, mockResponse);

      const result = await sharesService.listSchemas(shareName);

      assertSuccess(result);
      expect(result.value.items).toHaveLength(2);
      expect(result.value.items[0].name).toBe("schema1");
      expect(result.value.items[0].share).toBe(shareName);
    });

    it("should list schemas with pagination parameters", async () => {
      const shareName = "test_share";
      const mockResponse: ListSchemasResponse = {
        items: [{ name: "schema1", share: shareName }],
        nextPageToken: "next-token",
      };

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas`)
        .query({ maxResults: "5", pageToken: "token456" })
        .reply(200, mockResponse);

      const result = await sharesService.listSchemas(shareName, 5, "token456");

      assertSuccess(result);
      expect(result.value.nextPageToken).toBe("next-token");
    });

    it("should handle errors when listing schemas fails", async () => {
      const shareName = "test_share";

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas`)
        .reply(500, { error: "Internal server error" });

      const result = await sharesService.listSchemas(shareName);

      assertFailure(result);
      expect(result.error.message).toContain(`Failed to list schemas in share ${shareName}`);
    });
  });

  describe("listTables", () => {
    it("should successfully list tables in a schema", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const mockResponse: ListTablesResponse = {
        items: [
          { name: "table1", schema: schemaName, share: shareName },
          { name: "table2", schema: schemaName, share: shareName },
        ],
      };

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables`)
        .reply(200, mockResponse);

      const result = await sharesService.listTables(shareName, schemaName);

      assertSuccess(result);
      expect(result.value.items).toHaveLength(2);
      expect(result.value.items[0].name).toBe("table1");
      expect(result.value.items[0].schema).toBe(schemaName);
      expect(result.value.items[0].share).toBe(shareName);
    });

    it("should list tables with pagination parameters", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const mockResponse: ListTablesResponse = {
        items: [{ name: "table1", schema: schemaName, share: shareName }],
        nextPageToken: "next-token",
      };

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables`)
        .query({ maxResults: "20", pageToken: "token789" })
        .reply(200, mockResponse);

      const result = await sharesService.listTables(shareName, schemaName, 20, "token789");

      assertSuccess(result);
      expect(result.value.nextPageToken).toBe("next-token");
    });

    it("should handle name encoding for both share and schema", async () => {
      const shareName = "share name";
      const schemaName = "schema name";
      const mockResponse: ListTablesResponse = {
        items: [{ name: "table1", schema: schemaName, share: shareName }],
      };

      nock(deltaEndpoint)
        .get("/shares/share%20name/schemas/schema%20name/tables")
        .reply(200, mockResponse);

      const result = await sharesService.listTables(shareName, schemaName);

      assertSuccess(result);
      expect(result.value.items).toHaveLength(1);
    });

    it("should handle errors when listing tables fails", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables`)
        .reply(403, { errorCode: "FORBIDDEN", message: "Access denied" });

      const result = await sharesService.listTables(shareName, schemaName);

      assertFailure(result);
      expect(result.error.message).toContain(`Failed to list tables in ${shareName}.${schemaName}`);
    });
  });
});
