import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../../../common/modules/databricks/services/sql/sql.types";
import { failure } from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { UserRepository } from "../../../../../users/core/repositories/user.repository";
import { UserEnrichmentService } from "./user-enrichment.service";

interface UserObject {
  id: string;
  name: string;
  image: string | null;
}

function parseUserObject(userString: string | null | undefined): UserObject {
  if (!userString) {
    throw new Error("User string is null or undefined");
  }
  return JSON.parse(userString) as UserObject;
}

describe("UserEnrichmentService", () => {
  const testApp = TestHarness.App;
  let service: UserEnrichmentService;
  let userRepository: UserRepository;
  let testUser1Id: string;
  let testUser2Id: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    // Create test users
    testUser1Id = await testApp.createTestUser({
      email: "user1@example.com",
      name: "John Doe",
      image: "https://example.com/john.jpg",
    });
    testUser2Id = await testApp.createTestUser({
      email: "user2@example.com",
      name: "Jane Smith",
      image: null,
    });

    userRepository = testApp.module.get(UserRepository);
    service = testApp.module.get(UserEnrichmentService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getSourceColumns", () => {
    it("should return user_id and user_name as source columns", () => {
      expect(service.getSourceColumns()).toEqual(["user_id", "user_name"]);
    });
  });

  describe("getTargetColumn", () => {
    it("should return 'user' as target column", () => {
      expect(service.getTargetColumn()).toBe("user");
    });
  });

  describe("getTargetType", () => {
    it("should return 'USER' as target type", () => {
      expect(service.getTargetType()).toBe("USER");
    });
  });

  describe("canEnrich", () => {
    it("should return true when both user_id and user_name columns are present", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(true);
    });

    it("should return false when user_id column is missing", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(false);
    });

    it("should return false when user_name column is missing", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(false);
    });

    it("should return false when both user columns are missing", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
          { name: "humidity", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(false);
    });
  });

  describe("enrichData", () => {
    it("should enrich data by replacing user columns with user object", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
          { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        ],
        rows: [
          [testUser1Id, "John Doe", "25.5", "2023-01-01T12:00:00Z"],
          [testUser2Id, "Jane Smith", "26.0", "2023-01-01T12:01:00Z"],
        ],
        totalRows: 2,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      // Should have 3 columns: measurement, timestamp, and user
      expect(result.columns).toHaveLength(3);
      expect(result.columns).toEqual([
        { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "user", type_name: "USER", type_text: "USER" },
      ]);

      expect(result.rows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.truncated).toBe(false);

      // Check first row
      expect(result.rows[0]).toHaveProperty("measurement", "25.5");
      expect(result.rows[0]).toHaveProperty("timestamp", "2023-01-01T12:00:00Z");
      expect(result.rows[0]).toHaveProperty("user");

      const user1Object = parseUserObject(result.rows[0].user);
      expect(user1Object).toEqual({
        id: testUser1Id,
        name: "John Doe",
        image: "https://example.com/john.jpg",
      });

      // Check second row
      expect(result.rows[1]).toHaveProperty("measurement", "26.0");
      expect(result.rows[1]).toHaveProperty("timestamp", "2023-01-01T12:01:00Z");
      expect(result.rows[1]).toHaveProperty("user");

      const user2Object = parseUserObject(result.rows[1].user);
      expect(user2Object).toEqual({
        id: testUser2Id,
        name: "Jane Smith",
        image: null,
      });
    });

    it("should handle null user_id by setting user column to null", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [
          [testUser1Id, "John Doe", "25.5"],
          [null, "Unknown User", "26.0"],
        ],
        totalRows: 2,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      expect(result.rows).toHaveLength(2);

      // First row should have user object
      expect(result.rows[0]).toHaveProperty("user");
      const user1Object = parseUserObject(result.rows[0].user);
      expect(user1Object.id).toBe(testUser1Id);

      // Second row should have null user
      expect(result.rows[1]).toHaveProperty("user", null);
    });

    it("should handle empty data", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      expect(result.columns).toHaveLength(2); // measurement + user
      expect(result.rows).toEqual([]);
      expect(result.totalRows).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it("should handle users not found in repository", async () => {
      const nonExistentUserId = faker.string.uuid();

      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [[nonExistentUserId, "Non-existent User", "25.5"]],
        totalRows: 1,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty("user");

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const userObject = JSON.parse(result.rows[0].user!) as UserObject;
      expect(userObject).toEqual({
        id: nonExistentUserId,
        name: "Non-existent User",
        image: null, // Should be null when user not found in repository
      });
    });

    it("should handle repository failure gracefully", async () => {
      // Mock repository to return failure
      const mockFindUsersByIds = vi.spyOn(userRepository, "findUsersByIds").mockResolvedValue(
        failure({
          message: "Database error",
          code: "INTERNAL_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [[testUser1Id, "John Doe", "25.5"]],
        totalRows: 1,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty("user");

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const userObject = JSON.parse(result.rows[0].user!) as UserObject;
      expect(userObject).toEqual({
        id: testUser1Id,
        name: "John Doe",
        image: null, // Should fallback to null when repository fails
      });

      // Restore mock
      mockFindUsersByIds.mockRestore();
    });

    it("should handle duplicate user IDs efficiently", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [
          [testUser1Id, "John Doe", "25.5"],
          [testUser1Id, "John Doe", "26.0"],
          [testUser2Id, "Jane Smith", "24.8"],
        ],
        totalRows: 3,
        truncated: false,
      };

      // Spy on the repository method to verify it's called with unique IDs only
      const findUsersByIdsSpy = vi.spyOn(userRepository, "findUsersByIds");

      const result = await service.enrichData(schemaData);

      // Should only call repository once with unique user IDs
      expect(findUsersByIdsSpy).toHaveBeenCalledTimes(1);
      expect(findUsersByIdsSpy).toHaveBeenCalledWith([testUser1Id, testUser2Id]);

      expect(result.rows).toHaveLength(3);

      // All rows with same user ID should have same user object
      const user1Object1 = parseUserObject(result.rows[0].user);
      const user1Object2 = parseUserObject(result.rows[1].user);
      expect(user1Object1).toEqual(user1Object2);
      expect(user1Object1.id).toBe(testUser1Id);

      const user2Object = parseUserObject(result.rows[2].user);
      expect(user2Object.id).toBe(testUser2Id);

      findUsersByIdsSpy.mockRestore();
    });

    it("should preserve column order except for source columns", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
          { name: "user_name", type_name: "STRING", type_text: "STRING" },
          { name: "location", type_name: "STRING", type_text: "STRING" },
        ],
        rows: [["2023-01-01T12:00:00Z", testUser1Id, "25.5", "John Doe", "Lab A"]],
        totalRows: 1,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      // Should preserve order: timestamp, measurement, location, user (source columns removed, target added at end)
      expect(result.columns).toEqual([
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "location", type_name: "STRING", type_text: "STRING" },
        { name: "user", type_name: "USER", type_text: "USER" },
      ]);

      expect(result.rows[0]).toEqual({
        timestamp: "2023-01-01T12:00:00Z",
        measurement: "25.5",
        location: "Lab A",
        user: JSON.stringify({
          id: testUser1Id,
          name: "John Doe",
          image: "https://example.com/john.jpg",
        }),
      });
    });
  });
});
