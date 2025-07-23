import { TestHarness } from "@/test/test-harness";

import { flows as flowsTable, eq } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { FlowRepository } from "./flow.repository";

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
      const flowId = createResult.value[0].id;

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
  });
});
