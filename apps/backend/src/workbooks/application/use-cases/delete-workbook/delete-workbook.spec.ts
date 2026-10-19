import { eq, notifications, workbooks } from "@repo/database";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  grantResourceAudience,
  heardByAllButTheActor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { GetWorkbookUseCase } from "../get-workbook/get-workbook";
import { DeleteWorkbookUseCase } from "./delete-workbook";

describe("DeleteWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteWorkbookUseCase;
  let getUseCase: GetWorkbookUseCase;
  let repo: WorkbookRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteWorkbookUseCase);
    getUseCase = testApp.module.get(GetWorkbookUseCase);
    repo = testApp.module.get(WorkbookRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("deletes a workbook owned by the user", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);

    // Verify it no longer exists
    const getResult = await getUseCase.execute(workbook.id);
    assertFailure(getResult);
    expect(getResult.error.statusCode).toBe(404);
  });

  it("returns 404 when workbook does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("does not delete other workbooks", async () => {
    const wb1 = await testApp.createWorkbook({ name: "WB 1", createdBy: userId });
    const wb2 = await testApp.createWorkbook({ name: "WB 2", createdBy: userId });
    await useCase.execute(wb1.id, userId);

    const getResult = await getUseCase.execute(wb2.id);
    assertSuccess(getResult);
    expect(getResult.value.id).toBe(wb2.id);
  });

  it("returns failure when repository findById fails", async () => {
    vi.spyOn(repo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  it("returns failure when repository delete fails", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    vi.spyOn(repo, "delete").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  /** One workbook in an organization, shared with an admin and a viewer. */
  async function sharedWorkbook() {
    const audience = await seedResourceAudience(testApp);
    const resourceId = (
      await testApp.createWorkbook({
        name: "Season Report",
        createdBy: audience.owner,
        organizationId: audience.organizationId,
      })
    ).id;
    await grantResourceAudience(testApp, audience, "workbook", resourceId);
    return { audience, resourceId };
  }

  it("tells the grantees and the owner, not the deleter, and queues their emails", async () => {
    const { audience, resourceId } = await sharedWorkbook();

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(await audienceNotifications(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, (recipientId) => ({
        type: "resource_deleted",
        recipientId,
        actorId: audience.actor,
        resourceType: "workbook",
        resourceId,
        params: { resourceName: "Season Report" },
      })),
    );
    expect(await audienceDeliveries(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, () => ({ type: "resource_deleted", status: "pending" })),
    );
  });

  it("still deletes, telling nobody, when the members cannot be read", async () => {
    const { audience, resourceId } = await sharedWorkbook();
    vi.spyOn(testApp.module.get(SharingRepository), "listMemberIds").mockResolvedValue(
      failure(AppError.internal("members unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database.select().from(workbooks).where(eq(workbooks.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });

  it("still deletes when the notification cannot be stored", async () => {
    const { audience, resourceId } = await sharedWorkbook();
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database.select().from(workbooks).where(eq(workbooks.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });
});
