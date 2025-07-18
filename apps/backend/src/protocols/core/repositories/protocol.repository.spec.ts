import { faker } from "@faker-js/faker";

import { protocols as protocolsTable, eq } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ProtocolRepository } from "./protocol.repository";

describe("ProtocolRepository", () => {
  const testApp = TestHarness.App;
  let repository: ProtocolRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new protocol", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Test Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      // Act
      const result = await repository.create(createProtocolDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      const protocol = protocols[0];

      expect(protocol).toMatchObject({
        id: expect.any(String) as string,
        name: createProtocolDto.name,
        description: createProtocolDto.description,
        code: createProtocolDto.code,
        createdBy: testUserId,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(protocolsTable)
        .where(eq(protocolsTable.id, protocol.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: createProtocolDto.name,
        description: createProtocolDto.description,
        code: createProtocolDto.code,
        createdBy: testUserId,
      });
    });
  });

  describe("findAll", () => {
    it("should return all protocols without filter", async () => {
      // Arrange
      const protocol1 = {
        name: "Protocol 1",
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };
      const protocol2 = {
        name: "Protocol 2",
        description: "Description 2",
        code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
        family: "multispeq" as const,
      };

      await repository.create(protocol1, testUserId);
      await repository.create(protocol2, testUserId);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;

      expect(protocols.length).toBeGreaterThanOrEqual(2);
      expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
      expect(protocols.some((p) => p.name === protocol2.name)).toBe(true);
    });

    it("should filter protocols by name search", async () => {
      // Arrange
      const uniquePrefix = "UniqueTest";
      const protocol1 = {
        name: `${uniquePrefix} Protocol 1`,
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };
      const protocol2 = {
        name: "Different Protocol 2",
        description: "Description 2",
        code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
        family: "multispeq" as const,
      };

      await repository.create(protocol1, testUserId);
      await repository.create(protocol2, testUserId);

      // Act
      const result = await repository.findAll(uniquePrefix);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;

      expect(protocols.length).toBeGreaterThanOrEqual(1);
      expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
      expect(protocols.every((p) => p.name !== protocol2.name)).toBe(true);
    });

    it("should filter protocols by name search (case-insensitive)", async () => {
      // Arrange
      const uniquePrefix = "CaseTest";
      const protocol1 = {
        name: `${uniquePrefix} Protocol 1`,
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(protocol1, testUserId);

      // Act
      const result = await repository.findAll(uniquePrefix.toLowerCase());

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
    });
  });

  describe("findOne", () => {
    it("should find a protocol by id", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Find One Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createProtocolDto, testUserId);
      assertSuccess(createResult);
      const createdProtocol = createResult.value[0];

      // Act
      const result = await repository.findOne(createdProtocol.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocol = result.value;

      expect(protocol).not.toBeNull();
      expect(protocol).toMatchObject({
        id: createdProtocol.id,
        name: createProtocolDto.name,
        description: createProtocolDto.description,
        code: createProtocolDto.code,
        createdBy: testUserId,
      });
    });

    it("should return null if protocol not found", async () => {
      // Act
      const result = await repository.findOne(faker.string.uuid());

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("findByName", () => {
    it("should find a protocol by name", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Unique Name Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(createProtocolDto, testUserId);

      // Act
      const result = await repository.findByName(createProtocolDto.name);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocol = result.value;

      expect(protocol).not.toBeNull();
      expect(protocol).toMatchObject({
        name: createProtocolDto.name,
        description: createProtocolDto.description,
        code: createProtocolDto.code,
        createdBy: testUserId,
      });
    });

    it("should return null if protocol not found by name", async () => {
      // Act
      const result = await repository.findByName("non-existent-name");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a protocol", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Update Protocol",
        description: "Original Description",
        code: [{ steps: [{ name: "Original Step", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createProtocolDto, testUserId);
      assertSuccess(createResult);
      const createdProtocol = createResult.value[0];

      const updateProtocolDto = {
        name: "Updated Protocol",
        description: "Updated Description",
        code: [{ steps: [{ name: "Updated Step", action: "test" }] }],
      };

      // Act
      const result = await repository.update(createdProtocol.id, updateProtocolDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      const protocol = protocols[0];

      expect(protocol).toMatchObject({
        id: createdProtocol.id,
        name: updateProtocolDto.name,
        description: updateProtocolDto.description,
        code: updateProtocolDto.code,
        createdBy: testUserId,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(protocolsTable)
        .where(eq(protocolsTable.id, createdProtocol.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: updateProtocolDto.name,
        description: updateProtocolDto.description,
        code: updateProtocolDto.code,
      });
    });

    it("should handle partial updates", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Partial Update Protocol",
        description: "Original Description",
        code: [{ steps: [{ name: "Original Step", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createProtocolDto, testUserId);
      assertSuccess(createResult);
      const createdProtocol = createResult.value[0];

      // Only update the name
      const updateProtocolDto = {
        name: "Partially Updated Protocol",
      };

      // Act
      const result = await repository.update(createdProtocol.id, updateProtocolDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      const protocol = protocols[0];

      expect(protocol).toMatchObject({
        id: createdProtocol.id,
        name: updateProtocolDto.name,
        // These should remain unchanged
        description: createProtocolDto.description,
        code: createProtocolDto.code,
        createdBy: testUserId,
      });
    });
  });

  describe("delete", () => {
    it("should delete a protocol", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Delete Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createProtocolDto, testUserId);
      assertSuccess(createResult);
      const createdProtocol = createResult.value[0];

      // Act
      const result = await repository.delete(createdProtocol.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      const protocol = protocols[0];

      expect(protocol).toMatchObject({
        id: createdProtocol.id,
        name: createProtocolDto.name,
      });

      // Verify protocol is removed from database
      const dbResult = await testApp.database
        .select()
        .from(protocolsTable)
        .where(eq(protocolsTable.id, createdProtocol.id));

      expect(dbResult.length).toBe(0);
    });

    it("should handle deleting a non-existent protocol", async () => {
      // Act
      const result = await repository.delete(faker.string.uuid());

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;

      // Should return an empty array
      expect(protocols.length).toBe(0);
    });
  });
});
