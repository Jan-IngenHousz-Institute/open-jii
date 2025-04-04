import { Test, TestingModule } from "@nestjs/testing";
import { db, experiments, experimentMembers, users, eq } from "database";

import { DatabaseModule } from "../database/database.module";
import { ExperimentsService } from "./experiments.service";

describe("ExperimentsService", () => {
  let service: ExperimentsService;
  let testUserId: string;
  let otherUserId: string;
  const randomUUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeAll(async () => {
    // First, find any existing test users
    const existingTestUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "test@example.com"));
    const existingOtherUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "other@example.com"));

    // Clean up any existing test data in the correct order
    if (existingTestUser.length > 0) {
      await db
        .delete(experimentMembers)
        .where(eq(experimentMembers.userId, existingTestUser[0].id));
      await db
        .delete(experiments)
        .where(eq(experiments.createdBy, existingTestUser[0].id));
      await db.delete(users).where(eq(users.id, existingTestUser[0].id));
    }

    if (existingOtherUser.length > 0) {
      await db
        .delete(experimentMembers)
        .where(eq(experimentMembers.userId, existingOtherUser[0].id));
      await db
        .delete(experiments)
        .where(eq(experiments.createdBy, existingOtherUser[0].id));
      await db.delete(users).where(eq(users.id, existingOtherUser[0].id));
    }

    // Create test users
    const [testUser] = await db
      .insert(users)
      .values({
        email: "test@example.com",
      })
      .returning();
    testUserId = testUser.id;

    const [otherUser] = await db
      .insert(users)
      .values({
        email: "other@example.com",
      })
      .returning();
    otherUserId = otherUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(experimentMembers)
      .where(eq(experimentMembers.userId, testUserId));
    await db
      .delete(experimentMembers)
      .where(eq(experimentMembers.userId, otherUserId));
    await db.delete(experiments).where(eq(experiments.createdBy, testUserId));
    await db.delete(experiments).where(eq(experiments.createdBy, otherUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(users).where(eq(users.id, otherUserId));
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [ExperimentsService],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);

    // Clean up any existing test data
    await db
      .delete(experimentMembers)
      .where(eq(experimentMembers.userId, testUserId));
    await db
      .delete(experimentMembers)
      .where(eq(experimentMembers.userId, otherUserId));
    await db.delete(experiments).where(eq(experiments.createdBy, testUserId));
    await db.delete(experiments).where(eq(experiments.createdBy, otherUserId));
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create an experiment with userId", async () => {
      const dto = {
        name: "test experiment",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
        createdBy: testUserId,
      };

      const result = await service.create(dto, testUserId);
      expect(result).toBeDefined();

      // Verify the experiment was created
      const [created] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.name, "test experiment"));

      expect(created).toBeDefined();
      expect(created.name).toBe("test experiment");
      expect(created.createdBy).toBe(testUserId);
    });

    it("should assign the provided userId as createdBy", async () => {
      const dto = {
        name: "creator test experiment",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
        createdBy: otherUserId, // Try to set a different createdBy
      };

      const result = await service.create(dto, testUserId);
      expect(result).toBeDefined();

      // Verify the experiment was created with the correct userId
      const [created] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.name, "creator test experiment"));

      expect(created.createdBy).toBe(testUserId);
      expect(created.createdBy).not.toBe(otherUserId);
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      // Create some test experiments
      await db.insert(experiments).values([
        {
          name: "my experiment 1",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        },
        {
          name: "my experiment 2",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        },
        {
          name: "other experiment",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: otherUserId,
        },
      ]);

      // Create a test experiment member for the 'member' and 'related' tests
      const [experiment] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.name, "other experiment"));

      await db.insert(experimentMembers).values({
        experimentId: experiment.id,
        userId: testUserId,
      });
    });

    it("should return all experiments when no filter", async () => {
      const result = await service.findAll(testUserId);
      expect(result.length).toBe(3);
    });

    it('should filter by createdBy when filter is "my"', async () => {
      const result = await service.findAll(testUserId, "my");
      expect(result.every((exp) => exp.createdBy === testUserId)).toBe(true);
    });

    it('should filter by experimentMembers when filter is "member"', async () => {
      const result = await service.findAll(testUserId, "member");
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("other experiment");
    });

    it('should filter by both createdBy and experimentMembers when filter is "related"', async () => {
      // Create an experiment where user is both creator and member
      const [relatedExperiment] = await db
        .insert(experiments)
        .values({
          name: "related experiment",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        })
        .returning();

      await db.insert(experimentMembers).values({
        experimentId: relatedExperiment.id,
        userId: testUserId,
      });

      const result = await service.findAll(testUserId, "related");
      expect(result.length).toBe(4);
    });

    it("should return empty array when no experiments exist", async () => {
      // Clean up all test data first
      await db.delete(experimentMembers);
      await db.delete(experiments);

      const result = await service.findAll(testUserId);
      expect(result).toEqual([]);
    });

    it("should correctly filter private experiments by visibility", async () => {
      // Create a public and private experiment
      await db.insert(experiments).values([
        {
          name: "public experiment",
          status: "active",
          visibility: "public",
          embargoIntervalDays: 90,
          createdBy: otherUserId,
        },
      ]);

      // Implement this test if visibility filtering is added to the service
    });
  });

  describe("findOne", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await db
        .insert(experiments)
        .values({
          name: "test experiment for findOne",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;
    });

    it("should find one experiment by id", async () => {
      const result = await service.findOne(testExperimentId);
      expect(result).toBeDefined();
      expect(result?.id).toBe(testExperimentId);
    });

    it("should return null for non-existent experiment id", async () => {
      const result = await service.findOne(randomUUID);
      expect(result).toBeNull();
    });

    it("should return only the requested experiment", async () => {
      // Create another experiment to ensure we're only getting the right one
      await db.insert(experiments).values({
        name: "another experiment",
        status: "active",
        visibility: "private",
        embargoIntervalDays: 90,
        createdBy: testUserId,
      });

      const result = await service.findOne(testExperimentId);
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
          name: "test experiment for update",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        })
        .returning();
      testExperimentId = experiment.id;
    });

    it("should update an experiment", async () => {
      const dto = {
        name: "updated experiment name",
        status: "archived" as const,
      };

      await service.update(testExperimentId, dto);

      const updated = await service.findOne(testExperimentId);
      expect(updated?.name).toBe("updated experiment name");
      expect(updated?.status).toBe("archived");
    });

    it("should not throw an error when updating non-existent experiment", async () => {
      const dto = {
        name: "this won't be updated",
        status: "active" as const,
      };

      // This should not throw an error
      await expect(service.update(randomUUID, dto)).resolves.not.toThrow();

      // Verify nothing was actually updated
      const allExperiments = await db.select().from(experiments);
      const updatedExperiment = allExperiments.find(
        (exp) => exp.name === "this won't be updated",
      );
      expect(updatedExperiment).toBeUndefined();
    });

    it("should only update specified fields", async () => {
      const originalExperiment = await service.findOne(testExperimentId);
      if (!originalExperiment) {
        throw new Error("Test experiment not found");
      }

      // Only update the name
      const dto = {
        name: "partially updated name",
      };

      await service.update(testExperimentId, dto);

      const updated = await service.findOne(testExperimentId);
      if (!updated) {
        throw new Error("Updated experiment not found");
      }

      // Name should be updated
      expect(updated.name).toBe("partially updated name");

      // Other fields should remain unchanged
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
          name: "user's experiment",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        })
        .returning();
      userExperimentId = userExperiment.id;

      const [otherExperiment] = await db
        .insert(experiments)
        .values({
          name: "other user's experiment",
          status: "active",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: otherUserId,
        })
        .returning();
      otherUserExperimentId = otherExperiment.id;
    });

    it("should find only experiments that belong to a specific user with 'my' filter", async () => {
      const userExperiments = await service.findAll(testUserId, "my");
      expect(userExperiments.length).toBeGreaterThanOrEqual(1);
      expect(userExperiments.some((e) => e.id === userExperimentId)).toBe(true);
      expect(userExperiments.every((e) => e.createdBy === testUserId)).toBe(
        true,
      );

      const otherUserExperiments = await service.findAll(otherUserId, "my");
      expect(
        otherUserExperiments.some((e) => e.id === otherUserExperimentId),
      ).toBe(true);
      expect(
        otherUserExperiments.every((e) => e.createdBy === otherUserId),
      ).toBe(true);
    });

    it("should find experiments where user is a member with 'member' filter", async () => {
      // Make test user a member of other user's experiment
      await db.insert(experimentMembers).values({
        experimentId: otherUserExperimentId,
        userId: testUserId,
      });

      const memberExperiments = await service.findAll(testUserId, "member");
      expect(memberExperiments.length).toBeGreaterThanOrEqual(1);
      expect(
        memberExperiments.some((e) => e.id === otherUserExperimentId),
      ).toBe(true);

      // Other user should not be a member of any experiments yet
      const otherMemberExperiments = await service.findAll(
        otherUserId,
        "member",
      );
      expect(otherMemberExperiments.length).toBe(0);
    });
  });
});
