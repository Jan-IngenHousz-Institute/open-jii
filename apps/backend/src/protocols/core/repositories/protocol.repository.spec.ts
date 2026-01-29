import { faker } from "@faker-js/faker";

import { protocols as protocolsTable, experimentProtocols, eq } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ProtocolRepository } from "./protocol.repository";

describe("ProtocolRepository", () => {
  const testApp = TestHarness.App;
  let repository: ProtocolRepository;
  let testUserId: string;
  const testUserName = "Test User";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: testUserName });
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

    it("should return protocols ordered by sortOrder first, then alphabetically", async () => {
      // Arrange - create protocols with different sortOrder values and names
      const createResult1 = await repository.create(
        {
          name: "Zebra Protocol",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult1);

      const createResult2 = await repository.create(
        {
          name: "Alpha Protocol",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult2);

      const createResult3 = await repository.create(
        {
          name: "Featured Protocol 2",
          description: "Sort order 2",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult3);
      const protocolFeatured2 = createResult3.value[0];

      const createResult4 = await repository.create(
        {
          name: "Featured Protocol 1",
          description: "Sort order 1",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult4);
      const protocolFeatured1 = createResult4.value[0];

      // Set sortOrder values
      await repository.update(protocolFeatured1.id, { sortOrder: 1 });
      await repository.update(protocolFeatured2.id, { sortOrder: 2 });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;

      const protocolNames = protocols.map((p) => p.name);

      // Featured protocols should come first, ordered by sortOrder (1, then 2)
      expect(protocolNames[0]).toBe("Featured Protocol 1");
      expect(protocolNames[1]).toBe("Featured Protocol 2");

      // Then alphabetically: Alpha, then Zebra
      const alphaIndex = protocolNames.indexOf("Alpha Protocol");
      const zebraIndex = protocolNames.indexOf("Zebra Protocol");
      expect(alphaIndex).toBeGreaterThan(1); // After featured protocols
      expect(zebraIndex).toBeGreaterThan(alphaIndex); // Zebra after Alpha
    });

    it("should handle all protocols with sortOrder correctly", async () => {
      // Arrange - create protocols all with sortOrder
      const createResult1 = await repository.create(
        {
          name: "Third Priority",
          description: "Sort order 30",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult1);
      const protocol3 = createResult1.value[0];

      const createResult2 = await repository.create(
        {
          name: "First Priority",
          description: "Sort order 10",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult2);
      const protocol1 = createResult2.value[0];

      const createResult3 = await repository.create(
        {
          name: "Second Priority",
          description: "Sort order 20",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult3);
      const protocol2 = createResult3.value[0];

      // Set sortOrder values
      await repository.update(protocol1.id, { sortOrder: 10 });
      await repository.update(protocol2.id, { sortOrder: 20 });
      await repository.update(protocol3.id, { sortOrder: 30 });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;

      const protocolNames = protocols.map((p) => p.name);

      // Should be ordered by sortOrder value: 10, 20, 30
      expect(protocolNames[0]).toBe("First Priority");
      expect(protocolNames[1]).toBe("Second Priority");
      expect(protocolNames[2]).toBe("Third Priority");
    });

    it("should handle all protocols without sortOrder alphabetically", async () => {
      // Arrange - create protocols all without sortOrder
      await repository.create(
        {
          name: "Charlie",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Alpha",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Bravo",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;

      const protocolNames = protocols.map((p) => p.name);

      // Should be ordered alphabetically: Alpha, Bravo, Charlie
      expect(protocolNames[0]).toBe("Alpha");
      expect(protocolNames[1]).toBe("Bravo");
      expect(protocolNames[2]).toBe("Charlie");
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
        createdByName: testUserName,
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

  describe("anonymization", () => {
    it("should show real name for activated users", async () => {
      // Arrange
      const activeUserId = await testApp.createTestUser({
        name: "Active User",
        activated: true,
      });

      const createProtocolDto = {
        name: "Active Protocol",
        description: "Created by active user",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(createProtocolDto, activeUserId);

      // Act
      const result = await repository.findAll();
      assertSuccess(result);

      const protocol = result.value.find((p) => p.name === "Active Protocol");
      expect(protocol).toBeDefined();
      expect(protocol?.createdByName).toBe("Active User");
    });

    it("should anonymize names for deactivated users", async () => {
      // Arrange
      const inactiveUserId = await testApp.createTestUser({
        name: "Hidden User",
        activated: false,
      });

      const createProtocolDto = {
        name: "Hidden Protocol",
        description: "Created by inactive user",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(createProtocolDto, inactiveUserId);

      // Act
      const result = await repository.findAll();
      assertSuccess(result);

      const protocol = result.value.find((p) => p.name === "Hidden Protocol");
      expect(protocol).toBeDefined();
      expect(protocol?.createdByName).toBe("Unknown User");
    });

    it("should anonymize name in findOne for deactivated user", async () => {
      // Arrange
      const inactiveUserId = await testApp.createTestUser({
        name: "Ghost User",
        activated: false,
      });

      const createProtocolDto = {
        name: "Ghost Protocol",
        description: "Should be anonymized",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createProtocolDto, inactiveUserId);
      assertSuccess(createResult);
      const createdProtocol = createResult.value[0];

      // Act
      const result = await repository.findOne(createdProtocol.id);
      assertSuccess(result);

      // Assert
      expect(result.value?.createdByName).toBe("Unknown User");
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
        createdByName: testUserName,
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

  describe("isAssignedToAnyExperiment", () => {
    it("should return false if protocol is not assigned to any experiment", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Unassigned Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };
      const createResult = await repository.create(createProtocolDto, testUserId);
      assertSuccess(createResult);
      const protocolId = createResult.value[0].id;

      // Act
      const isAssigned = await repository.isAssignedToAnyExperiment(protocolId);

      // Assert
      assertSuccess(isAssigned);
      expect(isAssigned.value).toBe(false);
    });

    it("should return true if protocol is assigned to an experiment", async () => {
      // Arrange
      const createProtocolDto = {
        name: "Assigned Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };
      const createResult = await repository.create(createProtocolDto, testUserId);
      assertSuccess(createResult);
      const protocolId = createResult.value[0].id;

      // Create a valid experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Simulate assignment in experimentProtocols table
      await testApp.database.insert(experimentProtocols).values({
        protocolId,
        experimentId: experiment.id,
      });

      // Act
      const isAssigned = await repository.isAssignedToAnyExperiment(protocolId);

      // Assert
      assertSuccess(isAssigned);
      expect(isAssigned.value).toBe(true);
    });
  });
});
