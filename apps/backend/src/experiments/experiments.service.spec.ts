import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentsService } from './experiments.service';
import { db, experiments, experimentMembers, users, eq, type InferSelectModel } from 'database';
import { DatabaseModule } from '../database/database.module';

type Experiment = InferSelectModel<typeof experiments>;

describe('ExperimentsService', () => {
  let service: ExperimentsService;
  let testUserId: string;
  let otherUserId: string;

  beforeAll(async () => {
    // First, find any existing test users
    const existingTestUser = await db.select().from(users).where(eq(users.email, 'test@example.com'));
    const existingOtherUser = await db.select().from(users).where(eq(users.email, 'other@example.com'));

    // Clean up any existing test data in the correct order
    if (existingTestUser.length > 0) {
      await db.delete(experimentMembers).where(eq(experimentMembers.userId, existingTestUser[0].id));
      await db.delete(experiments).where(eq(experiments.createdBy, existingTestUser[0].id));
      await db.delete(users).where(eq(users.id, existingTestUser[0].id));
    }

    if (existingOtherUser.length > 0) {
      await db.delete(experimentMembers).where(eq(experimentMembers.userId, existingOtherUser[0].id));
      await db.delete(experiments).where(eq(experiments.createdBy, existingOtherUser[0].id));
      await db.delete(users).where(eq(users.id, existingOtherUser[0].id));
    }

    // Create test users
    const [testUser] = await db.insert(users).values({
      email: 'test@example.com',
    }).returning();
    testUserId = testUser.id;

    const [otherUser] = await db.insert(users).values({
      email: 'other@example.com',
    }).returning();
    otherUserId = otherUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(experimentMembers).where(eq(experimentMembers.userId, testUserId));
    await db.delete(experimentMembers).where(eq(experimentMembers.userId, otherUserId));
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
    await db.delete(experimentMembers).where(eq(experimentMembers.userId, testUserId));
    await db.delete(experimentMembers).where(eq(experimentMembers.userId, otherUserId));
    await db.delete(experiments).where(eq(experiments.createdBy, testUserId));
    await db.delete(experiments).where(eq(experiments.createdBy, otherUserId));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an experiment with userId', async () => {
      const dto = {
        name: 'test experiment',
        status: 'provisioning' as const,
        visibility: 'private' as const,
        embargoIntervalDays: 90,
        createdBy: testUserId,
      };

      const result = await service.create(dto, testUserId);
      expect(result).toBeDefined();

      // Verify the experiment was created
      const [created] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.name, 'test experiment'));

      expect(created).toBeDefined();
      expect(created.name).toBe('test experiment');
      expect(created.createdBy).toBe(testUserId);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create some test experiments
      await db.insert(experiments).values([
        {
          name: 'my experiment 1',
          status: 'active',
          visibility: 'private',
          embargoIntervalDays: 90,
          createdBy: testUserId,
        },
        {
          name: 'my experiment 2',
          status: 'active',
          visibility: 'private',
          embargoIntervalDays: 90,
          createdBy: testUserId,
        },
        {
          name: 'other experiment',
          status: 'active',
          visibility: 'private',
          embargoIntervalDays: 90,
          createdBy: otherUserId,
        },
      ]);

      // Create a test experiment member for the 'member' and 'related' tests
      const [experiment] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.name, 'other experiment'));

      await db.insert(experimentMembers).values({
        experimentId: experiment.id,
        userId: testUserId,
      });
    });

    it('should return all experiments when no filter', async () => {
      const result = await service.findAll();
      expect(result.length).toBe(3);
    });

    it('should filter by createdBy when filter is "my"', async () => {
      const result = await service.findAll(testUserId, 'my') as Experiment[];
      expect(result.length).toBe(2);
      expect(result.every(exp => exp.createdBy === testUserId)).toBe(true);
    });

    it('should filter by experimentMembers when filter is "member"', async () => {
      const result = await service.findAll(testUserId, 'member') as Experiment[];
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('other experiment');
    });

    it('should filter by both createdBy and experimentMembers when filter is "related"', async () => {
      // Create an experiment where user is both creator and member
      const [relatedExperiment] = await db.insert(experiments).values({
        name: 'related experiment',
        status: 'active',
        visibility: 'private',
        embargoIntervalDays: 90,
        createdBy: testUserId,
      }).returning();

      await db.insert(experimentMembers).values({
        experimentId: relatedExperiment.id,
        userId: testUserId,
      });

      const result = await service.findAll(testUserId, 'related') as Experiment[];
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('related experiment');
      expect(result[0].createdBy).toBe(testUserId);
    });

    it('should return empty array when filter is "related" but no matching experiments exist', async () => {
      const result = await service.findAll(testUserId, 'related') as Experiment[];
      expect(result.length).toBe(0);
    });
  });

  describe('findOne', () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await db.insert(experiments).values({
        name: 'test experiment for findOne',
        status: 'active',
        visibility: 'private',
        embargoIntervalDays: 90,
        createdBy: testUserId,
      }).returning();
      testExperimentId = experiment.id;
    });

    it('should find one experiment by id', async () => {
      const result = await service.findOne(testExperimentId);
      expect(result).toBeDefined();
      expect(result[0].id).toBe(testExperimentId);
    });
  });

  describe('update', () => {
    let testExperimentId: string;

    beforeEach(async () => {
      const [experiment] = await db.insert(experiments).values({
        name: 'test experiment for update',
        status: 'active',
        visibility: 'private',
        embargoIntervalDays: 90,
        createdBy: testUserId,
      }).returning();
      testExperimentId = experiment.id;
    });

    it('should update an experiment', async () => {
      const dto = {
        name: 'updated experiment name',
        status: 'archived' as const,
      };

      await service.update(testExperimentId, dto);

      const [updated] = await db
        .select()
        .from(experiments)
        .where(eq(experiments.id, testExperimentId));

      expect(updated.name).toBe('updated experiment name');
      expect(updated.status).toBe('archived');
    });
  });
}); 