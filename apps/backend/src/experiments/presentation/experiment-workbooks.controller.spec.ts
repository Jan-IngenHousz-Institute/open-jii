import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { AuthorizationService } from "../../authorization/authorization.service";
import { success, failure, AppError } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { AttachWorkbookUseCase } from "../application/use-cases/attach-workbook/attach-workbook";
import { DetachWorkbookUseCase } from "../application/use-cases/detach-workbook/detach-workbook";
import { SetWorkbookVersionUseCase } from "../application/use-cases/set-workbook-version/set-workbook-version";
import { UpgradeWorkbookVersionUseCase } from "../application/use-cases/upgrade-workbook-version/upgrade-workbook-version";

describe("ExperimentWorkbooksController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let manageableExperimentId: string;
  let attachUseCase: AttachWorkbookUseCase;
  let detachUseCase: DetachWorkbookUseCase;
  let upgradeUseCase: UpgradeWorkbookVersionUseCase;
  let setVersionUseCase: SetWorkbookVersionUseCase;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Manageable experiment",
      userId: testUserId,
    });
    manageableExperimentId = experiment.id;

    attachUseCase = testApp.module.get(AttachWorkbookUseCase);
    detachUseCase = testApp.module.get(DetachWorkbookUseCase);
    upgradeUseCase = testApp.module.get(UpgradeWorkbookVersionUseCase);
    setVersionUseCase = testApp.module.get(SetWorkbookVersionUseCase);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("attachWorkbook", () => {
    it("should attach a workbook and return version info", async () => {
      const workbookId = faker.string.uuid();
      const versionId = faker.string.uuid();
      vi.spyOn(attachUseCase, "execute").mockResolvedValue(
        success({ workbookId, workbookVersionId: versionId, version: 1 }),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ workbookId })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        workbookId,
        workbookVersionId: versionId,
        version: 1,
      });
    });

    it("should return 400 for invalid body (missing workbookId)", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 without auth", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp
        .post(path)
        .withoutAuth()
        .send({ workbookId: faker.string.uuid() })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 when user lacks admin access", async () => {
      const ownerId = await testApp.createTestUser({ email: "other-owner@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Another owner's experiment",
        userId: ownerId,
      });
      const executeSpy = vi.spyOn(attachUseCase, "execute");

      const expId = experiment.id;
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ workbookId: faker.string.uuid() })
        .expect(StatusCodes.FORBIDDEN);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should return 404 when experiment or workbook not found", async () => {
      vi.spyOn(attachUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ workbookId: faker.string.uuid() })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("detachWorkbook", () => {
    it("should detach a workbook and return updated experiment", async () => {
      vi.spyOn(detachUseCase, "execute").mockResolvedValue(
        success({
          id: faker.string.uuid(),
          name: "Test",
          description: null,
          status: "active",
          visibility: "private",
          embargoUntil: new Date(),
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          organizationId: null,
          anonymizeContributors: false,
          workbookId: null,
          workbookVersionId: faker.string.uuid(),
        } as any),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.detachWorkbook, { id: expId });
      const response = await testApp.post(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ workbookId: null });
    });

    it("should return 401 without auth", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.detachWorkbook, { id: expId });
      await testApp.post(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 when no workbook is attached", async () => {
      vi.spyOn(detachUseCase, "execute").mockResolvedValue(
        failure(AppError.badRequest("No workbook attached")),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.detachWorkbook, { id: expId });
      await testApp.post(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("upgradeWorkbookVersion", () => {
    it("should upgrade to the latest version", async () => {
      const workbookId = faker.string.uuid();
      const versionId = faker.string.uuid();
      vi.spyOn(upgradeUseCase, "execute").mockResolvedValue(
        success({ workbookId, workbookVersionId: versionId, version: 2 }),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.upgradeWorkbookVersion, {
        id: expId,
      });
      const response = await testApp.post(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        workbookId,
        workbookVersionId: versionId,
        version: 2,
      });
    });

    it("should return 401 without auth", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.upgradeWorkbookVersion, {
        id: expId,
      });
      await testApp.post(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 when no workbook is attached", async () => {
      vi.spyOn(upgradeUseCase, "execute").mockResolvedValue(
        failure(AppError.badRequest("No workbook attached")),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.upgradeWorkbookVersion, {
        id: expId,
      });
      await testApp.post(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("setWorkbookVersion", () => {
    it("should re-pin the experiment to the requested version", async () => {
      const workbookId = faker.string.uuid();
      const versionId = faker.string.uuid();
      vi.spyOn(setVersionUseCase, "execute").mockResolvedValue(
        success({ workbookId, workbookVersionId: versionId, version: 1 }),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        workbookId,
        workbookVersionId: versionId,
        version: 1,
      });
    });

    it("should return 400 for invalid body (missing versionId)", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 for a non-uuid versionId", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId: "not-a-uuid" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 without auth", async () => {
      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withoutAuth()
        .send({ versionId: faker.string.uuid() })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 when user lacks admin access", async () => {
      const ownerId = await testApp.createTestUser({ email: "version-owner@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Another owner's versioned experiment",
        userId: ownerId,
      });
      const executeSpy = vi.spyOn(setVersionUseCase, "execute");

      const expId = experiment.id;
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId: faker.string.uuid() })
        .expect(StatusCodes.FORBIDDEN);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should return 404 when the target version is not found", async () => {
      vi.spyOn(setVersionUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook version not found")),
      );

      const expId = manageableExperimentId;
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId: faker.string.uuid() })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("authorization", () => {
    it.each([
      {
        name: "attach workbook",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(
              testApp.resolveOrpcPath(contract.experiments.attachWorkbook, {
                id: experimentId,
              }),
            )
            .withAuth(userId)
            .send({ workbookId: faker.string.uuid() }),
      },
      {
        name: "detach workbook",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(
              testApp.resolveOrpcPath(contract.experiments.detachWorkbook, {
                id: experimentId,
              }),
            )
            .withAuth(userId),
      },
      {
        name: "upgrade workbook version",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(
              testApp.resolveOrpcPath(contract.experiments.upgradeWorkbookVersion, {
                id: experimentId,
              }),
            )
            .withAuth(userId),
      },
      {
        name: "set workbook version",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(
              testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, {
                id: experimentId,
              }),
            )
            .withAuth(userId)
            .send({ versionId: faker.string.uuid() }),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const unrelatedUserId = await testApp.createTestUser({});
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(manageableExperimentId, unrelatedUserId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(unrelatedUserId, {
        resourceType: "experiment",
        resourceId: manageableExperimentId,
        action,
      });
    });
  });
});
