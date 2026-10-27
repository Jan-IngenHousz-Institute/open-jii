import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { AttachWorkbookUseCase } from "../../../../experiments/application/use-cases/attach-workbook/attach-workbook";
import { notificationsFor } from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishIfDriftedUseCase } from "./publish-if-drifted";

describe("PublishIfDriftedUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: PublishIfDriftedUseCase;
  let workbookRepo: WorkbookRepository;
  let versionRepo: WorkbookVersionRepository;
  let userId: string;
  let workbookId: string;

  const versionsOf = async (id: string) => {
    const result = await versionRepo.findByWorkbookId(id);
    assertSuccess(result);
    return result.value.map((version) => version.version);
  };

  const drift = (content: string) =>
    workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content, isCollapsed: false }],
    });

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(PublishIfDriftedUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
    workbookId = (
      await testApp.createWorkbook({
        name: "Draft workbook",
        cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
        createdBy: userId,
      })
    ).id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("publishes version 1 for a workbook with no version yet", async () => {
    const result = await useCase.execute(workbookId, userId);

    assertSuccess(result);
    expect(result.value.version).toBe(1);
    expect(await versionsOf(workbookId)).toEqual([1]);
  });

  it("publishes a new version once the draft differs from the latest", async () => {
    assertSuccess(await useCase.execute(workbookId, userId));
    await drift("v2");

    const result = await useCase.execute(workbookId, userId);

    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(await versionsOf(workbookId)).toEqual([2, 1]);
  });

  it("returns the latest version and creates none when the draft already matches it", async () => {
    const first = await useCase.execute(workbookId, userId);
    assertSuccess(first);

    const again = await useCase.execute(workbookId, userId);

    assertSuccess(again);
    expect(again.value.id).toBe(first.value.id);
    expect(await versionsOf(workbookId)).toEqual([1]);
  });

  it("tells the admins of every experiment on an older version, leaving none out", async () => {
    const experimentAdmin = await testApp.createTestUser({ name: "Experiment Admin" });
    const { experiment } = await testApp.createExperiment({
      name: "Experiment on the workbook",
      userId: experimentAdmin,
    });
    assertSuccess(
      await testApp.module
        .get(AttachWorkbookUseCase)
        .execute(experiment.id, workbookId, experimentAdmin),
    );
    await drift("v2");

    assertSuccess(await useCase.execute(workbookId, userId));

    expect(await notificationsFor(testApp, experimentAdmin)).toEqual([
      expect.objectContaining({
        type: "workbook_version_published",
        actorId: userId,
        resourceId: experiment.id,
        params: {
          experimentName: "Experiment on the workbook",
          workbookName: "Draft workbook",
          version: "2",
        },
      }),
    ]);
    expect(await notificationsFor(testApp, userId)).toEqual([]);
  });

  it("leaves out the experiment the version is made for", async () => {
    const attach = testApp.module.get(AttachWorkbookUseCase);
    const experimentOn = async (adminId: string, name: string) => {
      const { experiment } = await testApp.createExperiment({ name, userId: adminId });
      assertSuccess(await attach.execute(experiment.id, workbookId, adminId));
      return experiment.id;
    };
    const skippedAdmin = await testApp.createTestUser({ name: "Skipped Admin" });
    const otherAdmin = await testApp.createTestUser({ name: "Other Admin" });
    const skippedExperiment = await experimentOn(skippedAdmin, "Skipped experiment");
    const otherExperiment = await experimentOn(otherAdmin, "Other experiment");
    await drift("v2");

    assertSuccess(
      await useCase.execute(workbookId, userId, { forExperimentId: skippedExperiment }),
    );

    expect(await notificationsFor(testApp, skippedAdmin)).toEqual([]);
    expect(await notificationsFor(testApp, otherAdmin)).toEqual([
      expect.objectContaining({ resourceId: otherExperiment }),
    ]);
  });

  it("returns not found for an unknown workbook", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
