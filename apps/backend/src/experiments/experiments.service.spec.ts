import { Test, TestingModule } from "@nestjs/testing";
import { db, experiments, experimentMembers, users, eq } from "database";

import { DatabaseModule } from "../database/database.module";
import { ExperimentsService } from "./experiments.service";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./schemas/experiment.schema";

// Test constants and fixtures
const TEST_IDS = {
  NON_EXISTENT: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
};

const TEST_EMAILS = {
  USER: "test@example.com",
  OTHER: "other@example.com",
};

/**
 * Creates a fixture for experiment data that matches the updated schema.
 * Note: id, createdAt, and createdBy are omitted from the schema.
 */
const createExperimentFixture = (
  options: Partial<CreateExperimentDto> = {},
) => ({
  name: "Test Experiment",
  description: "Test experiment description",
  status: "provisioning" as const,
  visibility: "private" as const,
  embargoIntervalDays: 90,
  ...options,
});

describe("ExperimentsService", () => {
  let service: ExperimentsService;
  let testUserId: string;
  let otherUserId: string;

  // Database setup and cleanup
  beforeAll(async () => {
    await cleanupTestUsers();
    const userIds = await createTestUsers();
    testUserId = userIds.testUserId;
    otherUserId = userIds.otherUserId;
  });

  afterAll(async () => {
    await cleanupTestData(testUserId, otherUserId);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [ExperimentsService],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
    await cleanupExperiments(testUserId, otherUserId);
  });

  // Core functionality tests
  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create an experiment with userId", async () => {
      // Arrange
      const dto = createExperimentFixture({
        name: "test experiment",
        status: "provisioning",
      });

      // Act
      const result = await service.create(dto, testUserId);

      // Assert
      expect(result).toBeDefined();
      const [created] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.name, "test experiment"));

      expect(created).toBeDefined();
      expect(created.name).toBe("test experiment");
      expect(created.createdBy).toBe(testUserId);
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      await createTestExperiments(testUserId, otherUserId);
    });

    it("should return all experiments when no filter", async () => {
      // Act
      const result = await service.findAll(testUserId);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter by user ID when no filter parameter is provided", async () => {
      // Act
      const result = await service.findAll(testUserId);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by createdBy when filter is "my"', async () => {
      // Act
      const result = await service.findAll(testUserId, "my");

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((exp) => exp.createdBy === testUserId)).toBe(true);
    });

    it('should filter by experimentMembers when filter is "member"', async () => {
      // Act
      const result = await service.findAll(testUserId, "member");

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("other experiment");
    });

    it('should filter by both createdBy or experimentMembers when filter is "related"', async () => {
      // Arrange
      const [relatedExperiment] = await db
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "related experiment",
          }),
          createdBy: testUserId,
        })
        .returning();

      await db.insert(experimentMembers).values({
        experimentId: relatedExperiment.id,
        userId: testUserId,
      });

      // Act
      const result = await service.findAll(testUserId, "related");

      // Assert
      expect(result.length).toBe(4);
    });

    it("should return empty array when no experiments exist", async () => {
      // Arrange
      await db.delete(experimentMembers);
      await db.delete(experiments);

      // Act
      const result = await service.findAll(testUserId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return empty array when no experiments exist", async () => {
      // Clean up all test data first
      await db.delete(experimentMembers);
      await db.delete(experiments);

      // Act
      const result = await service.findAll(testUserId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await db
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for findOne",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;
    });

    it("should find one experiment by id", async () => {
      // Act
      const result = await service.findOne(testExperimentId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(testExperimentId);
    });

    it("should return null for non-existent experiment id", async () => {
      // Act
      const result = await service.findOne(TEST_IDS.NON_EXISTENT);

      // Assert
      expect(result).toBeNull();
    });

    it("should return only the requested experiment", async () => {
      // Arrange
      await db.insert(experiments).values({
        ...createExperimentFixture({
          name: "another experiment",
        }),
        createdBy: testUserId,
      });

      // Act
      const result = await service.findOne(testExperimentId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(testExperimentId);
      expect(result?.name).toBe("test experiment for findOne");
    });
  });

  describe("update", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await db
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for update",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;
    });

    it("should update an experiment", async () => {
      // Arrange
      const dto: UpdateExperimentDto = {
        name: "updated experiment name",
        status: "archived",
      };

      // Act
      await service.update(testExperimentId, dto);

      // Assert
      const updated = await service.findOne(testExperimentId);
      expect(updated?.name).toBe("updated experiment name");
      expect(updated?.status).toBe("archived");
    });

    it("should not throw an error when updating non-existent experiment", async () => {
      // Arrange
      const dto: UpdateExperimentDto = {
        name: "this won't be updated",
        status: "active",
      };

      // Act & Assert
      await expect(
        service.update(TEST_IDS.NON_EXISTENT, dto),
      ).resolves.not.toThrow();

      const allExperiments = await db.select().from(experiments);
      const updatedExperiment = allExperiments.find(
        (exp) => exp.name === "this won't be updated",
      );
      expect(updatedExperiment).toBeUndefined();
    });

    it("should only update specified fields", async () => {
      // Arrange
      const originalExperiment = await service.findOne(testExperimentId);
      if (!originalExperiment) {
        throw new Error("Test experiment not found");
      }

      const dto: UpdateExperimentDto = {
        name: "partially updated name",
      };

      // Act
      await service.update(testExperimentId, dto);

      // Assert
      const updated = await service.findOne(testExperimentId);
      if (!updated) {
        throw new Error("Updated experiment not found");
      }

      expect(updated.name).toBe("partially updated name");
      expect(updated.status).toBe(originalExperiment.status);
      expect(updated.visibility).toBe(originalExperiment.visibility);
      expect(updated.embargoIntervalDays).toBe(
        originalExperiment.embargoIntervalDays,
      );
    });
  });

  describe("authorization scenarios", () => {
    let userExperimentId: string;
    let otherUserExperimentId: string;

    beforeEach(async () => {
      // Create experiments for different users
      const [userExperiment] = await db
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "user's experiment",
          }),
          createdBy: testUserId,
        })
        .returning();
      userExperimentId = userExperiment.id;

      const [otherExperiment] = await db
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "other user's experiment",
          }),
          createdBy: otherUserId,
        })
        .returning();
      otherUserExperimentId = otherExperiment.id;
    });

    it("should find only experiments that belong to a specific user with 'my' filter", async () => {
      // Act
      const userExperiments = await service.findAll(testUserId, "my");
      const otherUserExperiments = await service.findAll(otherUserId, "my");

      // Assert
      expect(userExperiments.some((e) => e.id === userExperimentId)).toBe(true);
      expect(userExperiments.every((e) => e.createdBy === testUserId)).toBe(
        true,
      );

      expect(
        otherUserExperiments.some((e) => e.id === otherUserExperimentId),
      ).toBe(true);
      expect(
        otherUserExperiments.every((e) => e.createdBy === otherUserId),
      ).toBe(true);
    });

    it("should find experiments where user is a member with 'member' filter", async () => {
      // Arrange
      await db.insert(experimentMembers).values({
        experimentId: otherUserExperimentId,
        userId: testUserId,
      });

      // Act
      const memberExperiments = await service.findAll(testUserId, "member");
      const otherMemberExperiments = await service.findAll(
        otherUserId,
        "member",
      );

      // Assert
      expect(memberExperiments.length).toBeGreaterThanOrEqual(1);
      expect(
        memberExperiments.some((e) => e.id === otherUserExperimentId),
      ).toBe(true);

      expect(otherMemberExperiments.length).toBe(0);
    });
  });
});

// Helper functions
async function cleanupTestUsers() {
  // Find and clean up existing test users
  const existingTestUser = await db
    .select()
    .from(users)
    .where(eq(users.email, TEST_EMAILS.USER));
  const existingOtherUser = await db
    .select()
    .from(users)
    .where(eq(users.email, TEST_EMAILS.OTHER));

  if (existingTestUser.length > 0) {
    await cleanupUserData(existingTestUser[0].id);
  }

  if (existingOtherUser.length > 0) {
    await cleanupUserData(existingOtherUser[0].id);
  }
}

async function cleanupUserData(userId: string) {
  await db
    .delete(experimentMembers)
    .where(eq(experimentMembers.userId, userId));
  await db.delete(experiments).where(eq(experiments.createdBy, userId));
  await db.delete(users).where(eq(users.id, userId));
}

async function createTestUsers() {
  const [testUser] = await db
    .insert(users)
    .values({
      email: TEST_EMAILS.USER,
    })
    .returning();

  const [otherUser] = await db
    .insert(users)
    .values({
      email: TEST_EMAILS.OTHER,
    })
    .returning();

  return {
    testUserId: testUser.id,
    otherUserId: otherUser.id,
  };
}

async function cleanupTestData(testUserId: string, otherUserId: string) {
  await cleanupUserData(testUserId);
  await cleanupUserData(otherUserId);
}

async function cleanupExperiments(testUserId: string, otherUserId: string) {
  await db
    .delete(experimentMembers)
    .where(eq(experimentMembers.userId, testUserId));
  await db
    .delete(experimentMembers)
    .where(eq(experimentMembers.userId, otherUserId));
  await db.delete(experiments).where(eq(experiments.createdBy, testUserId));
  await db.delete(experiments).where(eq(experiments.createdBy, otherUserId));
}

async function createTestExperiments(testUserId: string, otherUserId: string) {
  // Create test experiments with createdBy added explicitly to match how the service works
  await db.insert(experiments).values([
    {
      ...createExperimentFixture({
        name: "my experiment 1",
      }),
      createdBy: testUserId,
    },
    {
      ...createExperimentFixture({
        name: "my experiment 2",
      }),
      createdBy: testUserId,
    },
    {
      ...createExperimentFixture({
        name: "other experiment",
      }),
      createdBy: otherUserId,
    },
  ]);

  // Create membership link
  const [experiment] = await db
    .select()
    .from(experiments)
    .where(eq(experiments.name, "other experiment"));

  await db.insert(experimentMembers).values({
    experimentId: experiment.id,
    userId: testUserId,
  });
}
