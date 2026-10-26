import { eq, experiments, notificationDeliveries, notifications } from "@repo/database";

import { AppError, assertSuccess, failure } from "../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../notifications/core/repositories/notification.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  deliveriesFor,
  grantResourceAudience,
  notificationsFor,
  seedResourceAudience,
} from "../../../test/resource-audience";
import type { ResourceAudience } from "../../../test/resource-audience";
import { TestHarness } from "../../../test/test-harness";
import { EmbargoProcessorService } from "./embargo-processor.service";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("EmbargoProcessorService against the database", () => {
  const testApp = TestHarness.App;
  let service: EmbargoProcessorService;
  let audience: ResourceAudience;
  let orgAdmin: string;
  let experimentId: string;

  const visibilityOf = async (id: string) => {
    const [row] = await testApp.database
      .select({ visibility: experiments.visibility })
      .from(experiments)
      .where(eq(experiments.id, id));
    return row.visibility;
  };

  const storedCounts = async () => ({
    rows: (await testApp.database.select().from(notifications)).length,
    deliveries: (await testApp.database.select().from(notificationDeliveries)).length,
  });

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(EmbargoProcessorService);

    audience = await seedResourceAudience(testApp);
    orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
    await testApp.addOrganizationMember(audience.organizationId, orgAdmin, "admin");

    const { experiment } = await testApp.createExperiment({
      name: "Leaf Area Index",
      userId: audience.owner,
      organizationId: audience.organizationId,
      visibility: "private",
      embargoUntil: new Date(Date.now() - DAY_MS),
    });
    experimentId = experiment.id;
    await grantResourceAudience(testApp, audience, "experiment", experimentId);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("makes the experiment public and tells its admins and the owner, queueing their emails", async () => {
    await service.processExpiredEmbargoes();

    expect(await visibilityOf(experimentId)).toBe("public");
    const heard = (recipientId: string) => ({
      type: "experiment_made_public",
      recipientId,
      actorId: null,
      resourceType: "experiment",
      resourceId: experimentId,
      params: { experimentName: "Leaf Area Index" },
    });
    expect(await audienceNotifications(testApp, audience)).toEqual({
      owner: [heard(audience.owner)],
      actor: [heard(audience.actor)],
      admin: [heard(audience.admin)],
      viewer: [],
    });
    const pending = { type: "experiment_made_public", status: "pending" };
    expect(await audienceDeliveries(testApp, audience)).toEqual({
      owner: [pending],
      actor: [pending],
      admin: [pending],
      viewer: [],
    });
    expect(await notificationsFor(testApp, orgAdmin)).toEqual([]);
    expect(
      await testApp.database.select({ dedupeKey: notifications.dedupeKey }).from(notifications),
    ).toEqual(Array(3).fill({ dedupeKey: `embargo:${experimentId}` }));
  });

  it("stores the row but queues no email for an admin who switched the category off", async () => {
    assertSuccess(
      await testApp.module
        .get(NotificationRepository)
        .upsertPreference(audience.admin, "experiments_and_resources", "email", false),
    );

    await service.processExpiredEmbargoes();

    expect(await notificationsFor(testApp, audience.admin)).toHaveLength(1);
    expect(await deliveriesFor(testApp, audience.admin)).toEqual([]);
  });

  it("writes nothing new on a second run", async () => {
    await service.processExpiredEmbargoes();
    const first = await storedCounts();

    await service.processExpiredEmbargoes();

    expect(first).toEqual({ rows: 3, deliveries: 3 });
    expect(await storedCounts()).toEqual(first);
  });

  it("writes nothing new when another run finds the same experiment still private", async () => {
    await service.processExpiredEmbargoes();
    const first = await storedCounts();
    await testApp.database
      .update(experiments)
      .set({ visibility: "private" })
      .where(eq(experiments.id, experimentId));

    await service.processExpiredEmbargoes();

    expect(await visibilityOf(experimentId)).toBe("public");
    expect(first).toEqual({ rows: 3, deliveries: 3 });
    expect(await storedCounts()).toEqual(first);
  });

  it("leaves an experiment still under embargo alone and tells nobody", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Still embargoed",
      userId: audience.owner,
      organizationId: audience.organizationId,
      visibility: "private",
      embargoUntil: new Date(Date.now() + DAY_MS),
    });
    await grantResourceAudience(testApp, audience, "experiment", experiment.id);

    await service.processExpiredEmbargoes();

    expect(await visibilityOf(experiment.id)).toBe("private");
    expect(
      await testApp.database
        .select()
        .from(notifications)
        .where(eq(notifications.resourceId, experiment.id)),
    ).toEqual([]);
  });

  it("still makes the experiment public when the notification cannot be stored", async () => {
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    await service.processExpiredEmbargoes();

    expect(await visibilityOf(experimentId)).toBe("public");
    expect(await storedCounts()).toEqual({ rows: 0, deliveries: 0 });
  });
});
