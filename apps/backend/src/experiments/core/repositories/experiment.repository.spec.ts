import { Test, TestingModule } from "@nestjs/testing";

import {
  DatabaseInstance,
  eq,
  and,
  experimentMembers,
  experiments,
  users,
} from "@repo/database";

import { DatabaseModule } from "../../../database/database.module";
import "../../../test/setup";
// Import test setup to ensure .env.test is loaded
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "../models/experiment.model";
import { ExperimentRepository } from "./experiment.repository";

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

describe("ExperimentRepository", () => {
  let repository: ExperimentRepository;
  let testUserId: string;
  let otherUserId: string;
  let database: DatabaseInstance;

  // Database setup and cleanup
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    database = module.get("DATABASE");

    await cleanupTestUsers(database);
    const userIds = await createTestUsers(database);
    testUserId = userIds.testUserId;
    otherUserId = userIds.otherUserId;
  });

  afterAll(async () => {
    await cleanupTestData(testUserId, otherUserId, database);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [ExperimentRepository],
    }).compile();

    repository = module.get<ExperimentRepository>(ExperimentRepository);
    database = module.get("DATABASE");
    await cleanupExperiments(testUserId, otherUserId, database);
  });

  // Core functionality tests
  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("create", () => {
    it("should create an experiment with userId", async () => {
      // Arrange
      const dto = createExperimentFixture({
        name: "test experiment",
        status: "provisioning",
      });

      // Act
      const result = await repository.create(dto, testUserId);

      // Assert
      expect(result).toBeDefined();
      const [created] = await database
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
      await createTestExperiments(testUserId, otherUserId, database);
    });

    it("should return all experiments when no filter", async () => {
      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter by user ID when no filter parameter is provided", async () => {
      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by createdBy when filter is "my"', async () => {
      // Act
      const result = await repository.findAll(testUserId, "my");

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((exp) => exp.createdBy === testUserId)).toBe(true);
    });

    it('should filter by experimentMembers when filter is "member"', async () => {
      // Act
      const result = await repository.findAll(testUserId, "member");

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("other experiment");
    });

    it('should filter by both createdBy or experimentMembers when filter is "related"', async () => {
      // Arrange
      const [relatedExperiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "related experiment",
          }),
          createdBy: testUserId,
        })
        .returning();

      await database.insert(experimentMembers).values({
        experimentId: relatedExperiment.id,
        userId: testUserId,
      });

      // Act
      const result = await repository.findAll(testUserId, "related");

      // Assert
      expect(result.length).toBe(4);
    });

    it("should return empty array when no experiments exist", async () => {
      // Arrange
      await database.delete(experimentMembers);
      await database.delete(experiments);

      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await database
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
      const result = await repository.findOne(testExperimentId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(testExperimentId);
    });

    it("should return null for non-existent experiment id", async () => {
      // Act
      const result = await repository.findOne(TEST_IDS.NON_EXISTENT);

      // Assert
      expect(result).toBeNull();
    });

    it("should return only the requested experiment", async () => {
      // Arrange
      await database.insert(experiments).values({
        ...createExperimentFixture({
          name: "another experiment",
        }),
        createdBy: testUserId,
      });

      // Act
      const result = await repository.findOne(testExperimentId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(testExperimentId);
      expect(result?.name).toBe("test experiment for findOne");
    });
  });

  describe("update", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await database
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
      await repository.update(testExperimentId, dto);

      // Assert
      const updated = await repository.findOne(testExperimentId);
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
        repository.update(TEST_IDS.NON_EXISTENT, dto),
      ).resolves.not.toThrow();

      const allExperiments = await database.select().from(experiments);
      const updatedExperiment = allExperiments.find(
        (exp) => exp.name === "this won't be updated",
      );
      expect(updatedExperiment).toBeUndefined();
    });

    it("should only update specified fields", async () => {
      // Arrange
      const originalExperiment = await repository.findOne(testExperimentId);
      if (!originalExperiment) {
        throw new Error("Test experiment not found");
      }

      const dto: UpdateExperimentDto = {
        name: "partially updated name",
      };

      // Act
      await repository.update(testExperimentId, dto);

      // Assert
      const updated = await repository.findOne(testExperimentId);
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

  describe("delete", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for deletion",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;

      // Add a member to test cascading delete
      await database.insert(experimentMembers).values({
        experimentId: testExperimentId,
        userId: otherUserId,
      });
    });

    it("should delete an experiment and its members", async () => {
      // Act
      await repository.delete(testExperimentId);

      // Assert - No experiment should remain
      const remainingExperiment = await repository.findOne(testExperimentId);
      expect(remainingExperiment).toBeNull();

      // Assert - No members should remain
      const remainingMembers = await database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, testExperimentId));
      expect(remainingMembers.length).toBe(0);
    });

    it("should not throw error when deleting non-existent experiment", async () => {
      // Act & Assert
      await expect(
        repository.delete(TEST_IDS.NON_EXISTENT),
      ).resolves.not.toThrow();
    });
  });

  describe("addMember", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for member addition",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;
    });

    it("should add a member to an experiment", async () => {
      // Act
      await repository.addMember(testExperimentId, otherUserId, "admin");

      // Assert
      const members = await database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, testExperimentId),
            eq(experimentMembers.userId, otherUserId),
          ),
        );
      expect(members.length).toBe(1);
      expect(members[0].role).toBe("admin");
    });

    it("should update role when member already exists", async () => {
      // Arrange - Add initial member
      await repository.addMember(testExperimentId, otherUserId, "member");

      // Act - Update role
      await repository.addMember(testExperimentId, otherUserId, "admin");

      // Assert
      const members = await database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, testExperimentId),
            eq(experimentMembers.userId, otherUserId),
          ),
        );
      expect(members.length).toBe(1);
      expect(members[0].role).toBe("admin");
    });
  });

  describe("removeMember", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for member removal",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;

      // Add a member
      await database.insert(experimentMembers).values({
        experimentId: testExperimentId,
        userId: otherUserId,
      });
    });

    it("should remove a member from an experiment", async () => {
      // Act
      await repository.removeMember(testExperimentId, otherUserId);

      // Assert
      const members = await database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, testExperimentId),
            eq(experimentMembers.userId, otherUserId),
          ),
        );
      expect(members.length).toBe(0);
    });

    it("should not throw error when removing non-existent membership", async () => {
      // Act & Assert
      await expect(
        repository.removeMember(testExperimentId, "non-existent-user-id"),
      ).resolves.not.toThrow();
    });
  });

  describe("hasAccess", () => {
    let testExperimentId: string;
    let memberExperimentId: string;

    beforeEach(async () => {
      // Create an experiment where test user is the creator
      const [experiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for access check - creator",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;

      // Create another experiment where test user is a member
      const [otherExperiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for access check - member",
          }),
          createdBy: otherUserId,
        })
        .returning();
      memberExperimentId = otherExperiment.id;

      // Add test user as member
      await database.insert(experimentMembers).values({
        experimentId: memberExperimentId,
        userId: testUserId,
      });
    });

    it("should return true when user is the creator", async () => {
      // Act
      const hasAccess = await repository.hasAccess(
        testExperimentId,
        testUserId,
      );

      // Assert
      expect(hasAccess).toBe(true);
    });

    it("should return true when user is a member", async () => {
      // Act
      const hasAccess = await repository.hasAccess(
        memberExperimentId,
        testUserId,
      );

      // Assert
      expect(hasAccess).toBe(true);
    });

    it("should return false when user has no relation to the experiment", async () => {
      // Act
      const hasAccess = await repository.hasAccess(
        memberExperimentId,
        "unrelated-user-id",
      );

      // Assert
      expect(hasAccess).toBe(false);
    });

    it("should return false for non-existent experiment", async () => {
      // Act
      const hasAccess = await repository.hasAccess(
        TEST_IDS.NON_EXISTENT,
        testUserId,
      );

      // Assert
      expect(hasAccess).toBe(false);
    });
  });

  describe("getMembers", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "test experiment for get members",
          }),
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;

      // Add members
      await database.insert(experimentMembers).values([
        {
          experimentId: testExperimentId,
          userId: otherUserId,
          role: "admin",
        },
        {
          experimentId: testExperimentId,
          userId: "another-test-user-id",
          role: "member",
        },
      ]);
    });

    it("should return all members of an experiment", async () => {
      // Act
      const members = await repository.getMembers(testExperimentId);

      // Assert
      expect(members.length).toBe(2);
      expect(
        members.some((m) => m.userId === otherUserId && m.role === "admin"),
      ).toBe(true);
      expect(
        members.some(
          (m) => m.userId === "another-test-user-id" && m.role === "member",
        ),
      ).toBe(true);
    });

    it("should return empty array for non-existent experiment", async () => {
      // Act
      const members = await repository.getMembers(TEST_IDS.NON_EXISTENT);

      // Assert
      expect(members).toEqual([]);
    });
  });

  describe("authorization scenarios", () => {
    let userExperimentId: string;
    let otherUserExperimentId: string;

    beforeEach(async () => {
      // Create experiments for different users
      const [userExperiment] = await database
        .insert(experiments)
        .values({
          ...createExperimentFixture({
            name: "user's experiment",
          }),
          createdBy: testUserId,
        })
        .returning();
      userExperimentId = userExperiment.id;

      const [otherExperiment] = await database
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
      const userExperiments = await repository.findAll(testUserId, "my");
      const otherUserExperiments = await repository.findAll(otherUserId, "my");

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
      await database.insert(experimentMembers).values({
        experimentId: otherUserExperimentId,
        userId: testUserId,
      });

      // Act
      const memberExperiments = await repository.findAll(testUserId, "member");
      const otherMemberExperiments = await repository.findAll(
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
async function cleanupTestUsers(db: any) {
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
    await cleanupUserData(existingTestUser[0].id, db);
  }

  if (existingOtherUser.length > 0) {
    await cleanupUserData(existingOtherUser[0].id, db);
  }
}

async function cleanupUserData(userId: string, db: any) {
  await db
    .delete(experimentMembers)
    .where(eq(experimentMembers.userId, userId));
  await db.delete(experiments).where(eq(experiments.createdBy, userId));
  await db.delete(users).where(eq(users.id, userId));
}

async function createTestUsers(db: any) {
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

async function cleanupTestData(
  testUserId: string,
  otherUserId: string,
  db: any,
) {
  await cleanupUserData(testUserId, db);
  await cleanupUserData(otherUserId, db);
}

async function cleanupExperiments(
  testUserId: string,
  otherUserId: string,
  db: any,
) {
  await db
    .delete(experimentMembers)
    .where(eq(experimentMembers.userId, testUserId));
  await db
    .delete(experimentMembers)
    .where(eq(experimentMembers.userId, otherUserId));
  await db.delete(experiments).where(eq(experiments.createdBy, testUserId));
  await db.delete(experiments).where(eq(experiments.createdBy, otherUserId));
}

async function createTestExperiments(
  testUserId: string,
  otherUserId: string,
  db: any,
) {
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
