import { TestHarness } from "@/test/test-harness";

import { flows as flowsTable, eq } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { FlowRepository, FlowRepositoryError, FlowNotFoundError } from "./flow.repository";

describe("FlowRepository", () => {
  const testApp = TestHarness.App;
  let repository: FlowRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(FlowRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a flow successfully", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow for validation",
        version: 1,
        isActive: true,
      };

      const result = await repository.create(flowData, testUserId);

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        name: flowData.name,
        description: flowData.description,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
      expect(result.value[0].id).toBeDefined();
      expect(result.value[0].createdAt).toBeDefined();
      expect(result.value[0].updatedAt).toBeDefined();
    });

    it("should create a flow with minimal data", async () => {
      const flowData = {
        name: "Minimal Flow",
      };

      const result = await repository.create(flowData, testUserId);

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({
        name: flowData.name,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
    });
  });

  describe("findAll", () => {
    it("should return all active flows", async () => {
      // Create test flows
      const flow1 = { name: "Flow 1" };
      const flow2 = { name: "Flow 2" };
      const inactiveFlow = { name: "Inactive Flow", isActive: false };

      await repository.create(flow1, testUserId);
      await repository.create(flow2, testUserId);
      await repository.create(inactiveFlow, testUserId);

      const result = await repository.findAll();
      assertSuccess(result);

      // Should only return active flows
      expect(result.value).toHaveLength(2);
      expect(result.value.map((f) => f.name)).toContain("Flow 1");
      expect(result.value.map((f) => f.name)).toContain("Flow 2");
      expect(result.value.map((f) => f.name)).not.toContain("Inactive Flow");
    });

    it("should return flows ordered by creation date descending", async () => {
      const flow1 = { name: "First Flow" };
      const flow2 = { name: "Second Flow" };

      await repository.create(flow1, testUserId);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await repository.create(flow2, testUserId);

      const result = await repository.findAll();
      assertSuccess(result);

      expect(result.value[0].name).toBe("Second Flow");
      expect(result.value[1].name).toBe("First Flow");
    });
  });

  describe("findOne", () => {
    it("should find a flow by id", async () => {
      const flowData = { name: "Test Flow" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      const result = await repository.findOne(flowId);
      assertSuccess(result);

      expect(result.value).toMatchObject({
        id: flowId,
        name: flowData.name,
        createdBy: testUserId,
      });
    });

    it("should return null for non-existent flow", async () => {
      // Use a valid UUID format
      const result = await repository.findOne("123e4567-e89b-12d3-a456-426614174001");

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should not return inactive flows", async () => {
      const flowData = { name: "Inactive Flow", isActive: false };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      const result = await repository.findOne(flowId);
      assertSuccess(result);

      expect(result.value).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a flow successfully", async () => {
      const flowData = { name: "Original Flow" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId: string = createResult.value[0].id;

      const updateData = { name: "Updated Flow", description: "Updated description" };
      const result = await repository.update(flowId, updateData);
      assertSuccess(result);

      expect(result.value[0]).toMatchObject({
        id: flowId,
        name: "Updated Flow",
        description: "Updated description",
      });
      expect(new Date(result.value[0].updatedAt).getTime()).toBeGreaterThan(
        new Date(createResult.value[0].updatedAt).getTime(),
      );
    });
  });

  describe("delete", () => {
    it("should soft delete a flow", async () => {
      const flowData = { name: "Flow to Delete" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      const deleteResult = await repository.delete(flowId);
      assertSuccess(deleteResult);

      // Flow should not be found after soft delete
      const findResult = await repository.findOne(flowId);
      assertSuccess(findResult);
      expect(findResult.value).toBeNull();
    });
  });

  describe("hardDelete", () => {
    it("should permanently delete a flow", async () => {
      const flowData = { name: "Flow to Hard Delete" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      const deleteResult = await repository.hardDelete(flowId);
      assertSuccess(deleteResult);

      // Verify flow is completely removed from database
      const flowExists = await testApp.database
        .select()
        .from(flowsTable)
        .where(eq(flowsTable.id, flowId));

      expect(flowExists).toHaveLength(0);
    });

    it("should handle non-existent flow gracefully", async () => {
      const result = await repository.hardDelete("123e4567-e89b-12d3-a456-426614174001");
      assertSuccess(result);
    });
  });

  describe("error handling", () => {
    it("should handle invalid UUID format in findOne", async () => {
      const result = await repository.findOne("invalid-uuid");
      expect(result.isFailure()).toBe(true);
    });

    it("should handle invalid UUID format in update", async () => {
      const result = await repository.update("invalid-uuid", { name: "Updated" });
      expect(result.isFailure()).toBe(true);
    });

    it("should handle invalid UUID format in delete", async () => {
      const result = await repository.delete("invalid-uuid");
      expect(result.isFailure()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty name creation", async () => {
      const result = await repository.create({ name: "" }, testUserId);
      assertSuccess(result);
      expect(result.value[0].name).toBe("");
    });

    it("should handle very long names within database limits", async () => {
      const longName = "a".repeat(250); // Stay within varchar(255) limit
      const result = await repository.create({ name: longName }, testUserId);
      assertSuccess(result);
      expect(result.value[0].name).toBe(longName);
    });

    it("should handle null/undefined description", async () => {
      const flowData = { name: "Test Flow", description: null };
      const result = await repository.create(flowData, testUserId);
      assertSuccess(result);
      expect(result.value[0].description).toBeNull();
    });

    it("should handle concurrent updates", async () => {
      const flowData = { name: "Concurrent Flow" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      // Perform concurrent updates
      const [result1, result2] = await Promise.all([
        repository.update(flowId, { name: "Update 1" }),
        repository.update(flowId, { name: "Update 2" }),
      ]);

      assertSuccess(result1);
      assertSuccess(result2);
      // Both should succeed, with the last one winning
    });

    it("should handle multiple flows with same name", async () => {
      const flowData = { name: "Duplicate Name" };

      const result1 = await repository.create(flowData, testUserId);
      const result2 = await repository.create(flowData, testUserId);

      assertSuccess(result1);
      assertSuccess(result2);
      expect(result1.value[0].id).not.toBe(result2.value[0].id);
    });

    it("should handle findAll with large number of flows", async () => {
      // Create 50 flows to test performance
      const promises = Array.from({ length: 50 }, (_, i) =>
        repository.create({ name: `Flow ${i}` }, testUserId),
      );

      await Promise.all(promises);

      const result = await repository.findAll();
      assertSuccess(result);
      expect(result.value.length).toBe(50);
    });

    it("should handle update with no changes", async () => {
      const flowData = { name: "Original Flow" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      const result = await repository.update(flowId, {});
      assertSuccess(result);
      expect(result.value[0].name).toBe("Original Flow");
    });

    it("should handle update of non-existent flow", async () => {
      const result = await repository.update("123e4567-e89b-12d3-a456-426614174001", {
        name: "Updated",
      });
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle soft delete of already inactive flow", async () => {
      const flowData = { name: "Inactive Flow", isActive: false };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;

      const result = await repository.delete(flowId);
      assertSuccess(result);
    });

    describe("FlowRepositoryError", () => {
      it("should create error with message and default properties", () => {
        const error = new FlowRepositoryError("Test error message");

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("FLOW_REPOSITORY_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.details).toEqual({});
      });

      it("should create error with message and cause", () => {
        const cause = new Error("Root cause");
        const error = new FlowRepositoryError("Test error message", cause);

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("FLOW_REPOSITORY_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.details).toEqual({ cause });
      });

      it("should create error with undefined cause", () => {
        const error = new FlowRepositoryError("Test error message", undefined);

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("FLOW_REPOSITORY_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.details).toEqual({ cause: undefined });
      });

      it("should create error with null cause", () => {
        const error = new FlowRepositoryError("Test error message", null);

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("FLOW_REPOSITORY_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.details).toEqual({ cause: null });
      });

      it("should create error with complex cause object", () => {
        const cause = {
          type: "DatabaseError",
          details: { table: "flows", constraint: "foreign_key" },
        };
        const error = new FlowRepositoryError("Database constraint violation", cause);

        expect(error.message).toBe("Database constraint violation");
        expect(error.code).toBe("FLOW_REPOSITORY_ERROR");
        expect(error.statusCode).toBe(500);
        expect(error.details).toEqual({ cause });
      });
    });

    describe("FlowNotFoundError", () => {
      it("should create error with flow ID", () => {
        const flowId = "123e4567-e89b-12d3-a456-426614174000";
        const error = new FlowNotFoundError(flowId);

        expect(error.message).toBe(`Flow with ID ${flowId} not found`);
        expect(error.code).toBe("FLOW_NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.details).toEqual({ id: flowId });
      });

      it("should create error with invalid flow ID", () => {
        const invalidId = "invalid-uuid";
        const error = new FlowNotFoundError(invalidId);

        expect(error.message).toBe(`Flow with ID ${invalidId} not found`);
        expect(error.code).toBe("FLOW_NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.details).toEqual({ id: invalidId });
      });

      it("should create error with empty flow ID", () => {
        const emptyId = "";
        const error = new FlowNotFoundError(emptyId);

        expect(error.message).toBe(`Flow with ID ${emptyId} not found`);
        expect(error.code).toBe("FLOW_NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.details).toEqual({ id: emptyId });
      });

      it("should create error with special characters in flow ID", () => {
        const specialId = "flow-with-special-chars-!@#$%";
        const error = new FlowNotFoundError(specialId);

        expect(error.message).toBe(`Flow with ID ${specialId} not found`);
        expect(error.code).toBe("FLOW_NOT_FOUND");
        expect(error.statusCode).toBe(404);
        expect(error.details).toEqual({ id: specialId });
      });
    });
  });

  describe("data integrity", () => {
    it("should preserve creation metadata on update", async () => {
      const flowData = { name: "Original Flow" };
      const createResult = await repository.create(flowData, testUserId);
      assertSuccess(createResult);
      const flowId = createResult.value[0].id;
      const originalCreatedAt = createResult.value[0].createdAt;
      const originalCreatedBy = createResult.value[0].createdBy;

      const updateResult = await repository.update(flowId, { name: "Updated Flow" });
      assertSuccess(updateResult);

      expect(updateResult.value[0].createdAt).toEqual(originalCreatedAt);
      expect(updateResult.value[0].createdBy).toBe(originalCreatedBy);
      expect(new Date(updateResult.value[0].updatedAt).getTime()).toBeGreaterThan(
        new Date(originalCreatedAt).getTime(),
      );
    });

    it("should maintain version consistency", async () => {
      const flowData = { name: "Version Test", version: 5 };
      const result = await repository.create(flowData, testUserId);
      assertSuccess(result);
      expect(result.value[0].version).toBe(5);
    });

    it("should handle special characters in names and descriptions", async () => {
      const flowData = {
        name: "Test Flow with Special Characters: !@#$%^&*()_+-=[]{}|;:'\",.<>?",
        description: "Description with emojis 🚀 and unicode characters éñü",
      };

      const result = await repository.create(flowData, testUserId);
      assertSuccess(result);
      expect(result.value[0].name).toBe(flowData.name);
      expect(result.value[0].description).toBe(flowData.description);
    });
  });
});
