import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { AttachWorkbookUseCase } from "../application/use-cases/attach-workbook/attach-workbook";
import { DetachWorkbookUseCase } from "../application/use-cases/detach-workbook/detach-workbook";
import { SetWorkbookVersionUseCase } from "../application/use-cases/set-workbook-version/set-workbook-version";
import { UpgradeWorkbookVersionUseCase } from "../application/use-cases/upgrade-workbook-version/upgrade-workbook-version";

describe("ExperimentWorkbooksController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
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

      const expId = faker.string.uuid();
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
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 without auth", async () => {
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp
        .post(path)
        .withoutAuth()
        .send({ workbookId: faker.string.uuid() })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 when user lacks admin access", async () => {
      vi.spyOn(attachUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only admins can attach workbooks")),
      );

      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.attachWorkbook, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ workbookId: faker.string.uuid() })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 when experiment or workbook not found", async () => {
      vi.spyOn(attachUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      const expId = faker.string.uuid();
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
          workbookId: null,
          workbookVersionId: faker.string.uuid(),
        } as any),
      );

      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.detachWorkbook, { id: expId });
      const response = await testApp.post(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ workbookId: null });
    });

    it("should return 401 without auth", async () => {
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.detachWorkbook, { id: expId });
      await testApp.post(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 when no workbook is attached", async () => {
      vi.spyOn(detachUseCase, "execute").mockResolvedValue(
        failure(AppError.badRequest("No workbook attached")),
      );

      const expId = faker.string.uuid();
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

      const expId = faker.string.uuid();
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
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.upgradeWorkbookVersion, {
        id: expId,
      });
      await testApp.post(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 when no workbook is attached", async () => {
      vi.spyOn(upgradeUseCase, "execute").mockResolvedValue(
        failure(AppError.badRequest("No workbook attached")),
      );

      const expId = faker.string.uuid();
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

      const expId = faker.string.uuid();
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
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 for a non-uuid versionId", async () => {
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId: "not-a-uuid" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 without auth", async () => {
      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withoutAuth()
        .send({ versionId: faker.string.uuid() })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 when user lacks admin access", async () => {
      vi.spyOn(setVersionUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only admins can change the workbook version")),
      );

      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId: faker.string.uuid() })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 when the target version is not found", async () => {
      vi.spyOn(setVersionUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook version not found")),
      );

      const expId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.setWorkbookVersion, { id: expId });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ versionId: faker.string.uuid() })
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
