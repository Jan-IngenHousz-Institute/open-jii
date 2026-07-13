import { faker } from "@faker-js/faker";

import { commands as commandsTable, eq } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { CommandRepository } from "./command.repository";

describe("CommandRepository", () => {
  const testApp = TestHarness.App;
  let repository: CommandRepository;
  let testUserId: string;
  const testUserName = "Test User";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: testUserName });
    repository = testApp.module.get(CommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new command", async () => {
      // Arrange
      const createCommandDto = {
        name: "Test Command",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      // Act
      const result = await repository.create(createCommandDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;
      const command = commands[0];

      expect(command).toMatchObject({
        id: expect.any(String) as string,
        name: createCommandDto.name,
        description: createCommandDto.description,
        code: createCommandDto.code,
        createdBy: testUserId,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(commandsTable)
        .where(eq(commandsTable.id, command.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: createCommandDto.name,
        description: createCommandDto.description,
        code: createCommandDto.code,
        createdBy: testUserId,
      });
    });
  });

  describe("findAll", () => {
    it("should return all commands without filter", async () => {
      // Arrange
      const command1 = {
        name: "Command 1",
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };
      const command2 = {
        name: "Command 2",
        description: "Description 2",
        code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
        family: "multispeq" as const,
      };

      await repository.create(command1, testUserId);
      await repository.create(command2, testUserId);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;

      expect(commands.length).toBeGreaterThanOrEqual(2);
      expect(commands.some((p) => p.name === command1.name)).toBe(true);
      expect(commands.some((p) => p.name === command2.name)).toBe(true);
    });

    it("should return commands ordered by sortOrder first, then alphabetically", async () => {
      // Arrange - create commands with different sortOrder values and names
      const createResult1 = await repository.create(
        {
          name: "Zebra Command",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult1);

      const createResult2 = await repository.create(
        {
          name: "Alpha Command",
          description: "No sort order",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult2);

      const createResult3 = await repository.create(
        {
          name: "Featured Command 2",
          description: "Sort order 2",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult3);
      const commandFeatured2 = createResult3.value[0];

      const createResult4 = await repository.create(
        {
          name: "Featured Command 1",
          description: "Sort order 1",
          code: [{ steps: [{ name: "Step 1", action: "test" }] }],
          family: "multispeq",
        },
        testUserId,
      );
      assertSuccess(createResult4);
      const commandFeatured1 = createResult4.value[0];

      // Set sortOrder values
      await repository.update(commandFeatured1.id, { sortOrder: 1 });
      await repository.update(commandFeatured2.id, { sortOrder: 2 });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;

      const commandNames = commands.map((p) => p.name);

      // Featured commands should come first, ordered by sortOrder (1, then 2)
      expect(commandNames[0]).toBe("Featured Command 1");
      expect(commandNames[1]).toBe("Featured Command 2");

      // Then alphabetically: Alpha, then Zebra
      const alphaIndex = commandNames.indexOf("Alpha Command");
      const zebraIndex = commandNames.indexOf("Zebra Command");
      expect(alphaIndex).toBeGreaterThan(1); // After featured commands
      expect(zebraIndex).toBeGreaterThan(alphaIndex); // Zebra after Alpha
    });

    it("should handle all commands with sortOrder correctly", async () => {
      // Arrange - create commands all with sortOrder
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
      const command3 = createResult1.value[0];

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
      const command1 = createResult2.value[0];

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
      const command2 = createResult3.value[0];

      // Set sortOrder values
      await repository.update(command1.id, { sortOrder: 10 });
      await repository.update(command2.id, { sortOrder: 20 });
      await repository.update(command3.id, { sortOrder: 30 });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;

      const commandNames = commands.map((p) => p.name);

      // Should be ordered by sortOrder value: 10, 20, 30
      expect(commandNames[0]).toBe("First Priority");
      expect(commandNames[1]).toBe("Second Priority");
      expect(commandNames[2]).toBe("Third Priority");
    });

    it("should handle all commands without sortOrder alphabetically", async () => {
      // Arrange - create commands all without sortOrder
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
      const commands = result.value;

      const commandNames = commands.map((p) => p.name);

      // Should be ordered alphabetically: Alpha, Bravo, Charlie
      expect(commandNames[0]).toBe("Alpha");
      expect(commandNames[1]).toBe("Bravo");
      expect(commandNames[2]).toBe("Charlie");
    });

    it("should filter commands by name search", async () => {
      // Arrange
      const uniquePrefix = "UniqueTest";
      const command1 = {
        name: `${uniquePrefix} Command 1`,
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };
      const command2 = {
        name: "Different Command 2",
        description: "Description 2",
        code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
        family: "multispeq" as const,
      };

      await repository.create(command1, testUserId);
      await repository.create(command2, testUserId);

      // Act
      const result = await repository.findAll(uniquePrefix);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;

      expect(commands.length).toBeGreaterThanOrEqual(1);
      expect(commands.some((p) => p.name === command1.name)).toBe(true);
      expect(commands.every((p) => p.name !== command2.name)).toBe(true);
    });

    it("should filter commands by name search (case-insensitive)", async () => {
      // Arrange
      const uniquePrefix = "CaseTest";
      const command1 = {
        name: `${uniquePrefix} Command 1`,
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(command1, testUserId);

      // Act
      const result = await repository.findAll(uniquePrefix.toLowerCase());

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;
      expect(commands.some((p) => p.name === command1.name)).toBe(true);
    });
  });

  describe("findOne", () => {
    it("should find a command by id", async () => {
      // Arrange
      const createCommandDto = {
        name: "Find One Command",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createCommandDto, testUserId);
      assertSuccess(createResult);
      const createdCommand = createResult.value[0];

      // Act
      const result = await repository.findOne(createdCommand.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const command = result.value;

      expect(command).not.toBeNull();
      expect(command).toMatchObject({
        id: createdCommand.id,
        name: createCommandDto.name,
        description: createCommandDto.description,
        code: createCommandDto.code,
        createdBy: testUserId,
        createdByName: testUserName,
      });
    });

    it("should return null if command not found", async () => {
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

      const createCommandDto = {
        name: "Active Command",
        description: "Created by active user",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(createCommandDto, activeUserId);

      // Act
      const result = await repository.findAll();
      assertSuccess(result);

      const command = result.value.find((p) => p.name === "Active Command");
      expect(command).toBeDefined();
      expect(command?.createdByName).toBe("Active User");
    });

    it("should anonymize names for deactivated users", async () => {
      // Arrange
      const inactiveUserId = await testApp.createTestUser({
        name: "Hidden User",
        activated: false,
      });

      const createCommandDto = {
        name: "Hidden Command",
        description: "Created by inactive user",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(createCommandDto, inactiveUserId);

      // Act
      const result = await repository.findAll();
      assertSuccess(result);

      const command = result.value.find((p) => p.name === "Hidden Command");
      expect(command).toBeDefined();
      expect(command?.createdByName).toBe("Unknown User");
    });

    it("should anonymize name in findOne for deactivated user", async () => {
      // Arrange
      const inactiveUserId = await testApp.createTestUser({
        name: "Ghost User",
        activated: false,
      });

      const createCommandDto = {
        name: "Ghost Command",
        description: "Should be anonymized",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createCommandDto, inactiveUserId);
      assertSuccess(createResult);
      const createdCommand = createResult.value[0];

      // Act
      const result = await repository.findOne(createdCommand.id);
      assertSuccess(result);

      // Assert
      expect(result.value?.createdByName).toBe("Unknown User");
    });
  });

  describe("findByName", () => {
    it("should find a command by name", async () => {
      // Arrange
      const createCommandDto = {
        name: "Unique Name Command",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      await repository.create(createCommandDto, testUserId);

      // Act
      const result = await repository.findByName(createCommandDto.name);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const command = result.value;

      expect(command).not.toBeNull();
      expect(command).toMatchObject({
        name: createCommandDto.name,
        description: createCommandDto.description,
        code: createCommandDto.code,
        createdBy: testUserId,
        createdByName: testUserName,
      });
    });

    it("should return null if command not found by name", async () => {
      // Act
      const result = await repository.findByName("non-existent-name");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a command", async () => {
      // Arrange
      const createCommandDto = {
        name: "Update Command",
        description: "Original Description",
        code: [{ steps: [{ name: "Original Step", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createCommandDto, testUserId);
      assertSuccess(createResult);
      const createdCommand = createResult.value[0];

      const updateCommandDto = {
        name: "Updated Command",
        description: "Updated Description",
        code: [{ steps: [{ name: "Updated Step", action: "test" }] }],
      };

      // Act
      const result = await repository.update(createdCommand.id, updateCommandDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;
      const command = commands[0];

      expect(command).toMatchObject({
        id: createdCommand.id,
        name: updateCommandDto.name,
        description: updateCommandDto.description,
        code: updateCommandDto.code,
        createdBy: testUserId,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(commandsTable)
        .where(eq(commandsTable.id, createdCommand.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: updateCommandDto.name,
        description: updateCommandDto.description,
        code: updateCommandDto.code,
      });
    });

    it("should handle partial updates", async () => {
      // Arrange
      const createCommandDto = {
        name: "Partial Update Command",
        description: "Original Description",
        code: [{ steps: [{ name: "Original Step", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createCommandDto, testUserId);
      assertSuccess(createResult);
      const createdCommand = createResult.value[0];

      // Only update the name
      const updateCommandDto = {
        name: "Partially Updated Command",
      };

      // Act
      const result = await repository.update(createdCommand.id, updateCommandDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;
      const command = commands[0];

      expect(command).toMatchObject({
        id: createdCommand.id,
        name: updateCommandDto.name,
        // These should remain unchanged
        description: createCommandDto.description,
        code: createCommandDto.code,
        createdBy: testUserId,
      });
    });
  });

  describe("delete", () => {
    it("should delete a command", async () => {
      // Arrange
      const createCommandDto = {
        name: "Delete Command",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
        family: "multispeq" as const,
      };

      const createResult = await repository.create(createCommandDto, testUserId);
      assertSuccess(createResult);
      const createdCommand = createResult.value[0];

      // Act
      const result = await repository.delete(createdCommand.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;
      const command = commands[0];

      expect(command).toMatchObject({
        id: createdCommand.id,
        name: createCommandDto.name,
      });

      // Verify command is removed from database
      const dbResult = await testApp.database
        .select()
        .from(commandsTable)
        .where(eq(commandsTable.id, createdCommand.id));

      expect(dbResult.length).toBe(0);
    });

    it("should handle deleting a non-existent command", async () => {
      // Act
      const result = await repository.delete(faker.string.uuid());

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const commands = result.value;

      // Should return an empty array
      expect(commands.length).toBe(0);
    });
  });
});
