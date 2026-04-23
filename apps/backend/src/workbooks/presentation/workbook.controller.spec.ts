import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateWorkbookUseCase } from "../application/use-cases/create-workbook/create-workbook";
import { DeleteWorkbookUseCase } from "../application/use-cases/delete-workbook/delete-workbook";
import { GetWorkbookVersionUseCase } from "../application/use-cases/get-workbook-version/get-workbook-version";
import { GetWorkbookUseCase } from "../application/use-cases/get-workbook/get-workbook";
import { ListWorkbookVersionsUseCase } from "../application/use-cases/list-workbook-versions/list-workbook-versions";
import { ListWorkbooksUseCase } from "../application/use-cases/list-workbooks/list-workbooks";
import { UpdateWorkbookUseCase } from "../application/use-cases/update-workbook/update-workbook";
import type { WorkbookVersionDto } from "../core/models/workbook-version.model";
import type { WorkbookDto } from "../core/models/workbook.model";

describe("WorkbookController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createWorkbookUseCase: CreateWorkbookUseCase;
  let getWorkbookUseCase: GetWorkbookUseCase;
  let listWorkbooksUseCase: ListWorkbooksUseCase;
  let updateWorkbookUseCase: UpdateWorkbookUseCase;
  let deleteWorkbookUseCase: DeleteWorkbookUseCase;
  let listWorkbookVersionsUseCase: ListWorkbookVersionsUseCase;
  let getWorkbookVersionUseCase: GetWorkbookVersionUseCase;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    createWorkbookUseCase = testApp.module.get(CreateWorkbookUseCase);
    getWorkbookUseCase = testApp.module.get(GetWorkbookUseCase);
    listWorkbooksUseCase = testApp.module.get(ListWorkbooksUseCase);
    updateWorkbookUseCase = testApp.module.get(UpdateWorkbookUseCase);
    deleteWorkbookUseCase = testApp.module.get(DeleteWorkbookUseCase);
    listWorkbookVersionsUseCase = testApp.module.get(ListWorkbookVersionsUseCase);
    getWorkbookVersionUseCase = testApp.module.get(GetWorkbookVersionUseCase);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const mockWorkbook = (overrides?: Partial<WorkbookDto>): WorkbookDto => ({
    id: faker.string.uuid(),
    name: "Test Workbook",
    description: "A test workbook",
    cells: [],
    metadata: {},
    createdBy: testUserId,
    createdByName: faker.person.fullName(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("createWorkbook", () => {
    it("should successfully create a workbook", async () => {
      const mock = mockWorkbook();
      vi.spyOn(createWorkbookUseCase, "execute").mockResolvedValue(success(mock));

      const response = await testApp
        .post(contract.workbooks.createWorkbook.path)
        .withAuth(testUserId)
        .send({ name: "Test Workbook", description: "A test workbook" })
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        name: "Test Workbook",
        description: "A test workbook",
        createdBy: testUserId,
      });
      expect(response.body).toHaveProperty("id");
    });

    it("should reject invalid body (missing name)", async () => {
      await testApp
        .post(contract.workbooks.createWorkbook.path)
        .withAuth(testUserId)
        .send({ description: "No name" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 500 when use case fails", async () => {
      vi.spyOn(createWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .post(contract.workbooks.createWorkbook.path)
        .withAuth(testUserId)
        .send({ name: "Test" })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should return 401 without auth", async () => {
      await testApp
        .post(contract.workbooks.createWorkbook.path)
        .withoutAuth()
        .send({ name: "Test" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getWorkbook", () => {
    it("should return a workbook by ID", async () => {
      const mock = mockWorkbook();
      vi.spyOn(getWorkbookUseCase, "execute").mockResolvedValue(success(mock));

      const path = testApp.resolvePath(contract.workbooks.getWorkbook.path, { id: mock.id });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: mock.id,
        name: mock.name,
      });
    });

    it("should return 404 for non-existent workbook", async () => {
      vi.spyOn(getWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook not found")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.getWorkbook.path, { id });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listWorkbooks", () => {
    it("should return a list of workbooks", async () => {
      const mocks = [mockWorkbook(), mockWorkbook({ name: "Second Workbook" })];
      vi.spyOn(listWorkbooksUseCase, "execute").mockResolvedValue(success(mocks));

      const response = await testApp
        .get(contract.workbooks.listWorkbooks.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
    });

    it("should pass search and filter to use case", async () => {
      const executeSpy = vi.spyOn(listWorkbooksUseCase, "execute").mockResolvedValue(success([]));

      await testApp
        .get(contract.workbooks.listWorkbooks.path)
        .query({ search: "test", filter: "my" })
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(executeSpy).toHaveBeenCalledWith({
        search: "test",
        filter: "my",
        userId: testUserId,
      });
    });

    it("should return 500 when use case fails", async () => {
      vi.spyOn(listWorkbooksUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .get(contract.workbooks.listWorkbooks.path)
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateWorkbook", () => {
    it("should update a workbook", async () => {
      const mock = mockWorkbook({ name: "Updated Name" });
      vi.spyOn(updateWorkbookUseCase, "execute").mockResolvedValue(success(mock));

      const path = testApp.resolvePath(contract.workbooks.updateWorkbook.path, { id: mock.id });
      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ name: "Updated Name" })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ name: "Updated Name" });
    });

    it("should return 403 for non-owner update", async () => {
      vi.spyOn(updateWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only the workbook creator can update this workbook")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.updateWorkbook.path, { id });
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ name: "Nope" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for non-existent workbook", async () => {
      vi.spyOn(updateWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook not found")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.updateWorkbook.path, { id });
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ name: "Nope" })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("deleteWorkbook", () => {
    it("should delete a workbook", async () => {
      vi.spyOn(deleteWorkbookUseCase, "execute").mockResolvedValue(success(undefined));

      const id = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.deleteWorkbook.path, { id });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);
    });

    it("should return 403 for non-owner deletion", async () => {
      vi.spyOn(deleteWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only the workbook creator can delete this workbook")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.deleteWorkbook.path, { id });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for non-existent workbook", async () => {
      vi.spyOn(deleteWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook not found")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.deleteWorkbook.path, { id });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listWorkbookVersions", () => {
    const mockVersion = (overrides?: Partial<WorkbookVersionDto>): WorkbookVersionDto => ({
      id: faker.string.uuid(),
      workbookId: faker.string.uuid(),
      version: 1,
      cells: [],
      metadata: {},
      createdAt: new Date(),
      createdBy: testUserId,
      ...overrides,
    });

    it("should list versions for a workbook", async () => {
      const versions = [mockVersion({ version: 2 }), mockVersion({ version: 1 })];
      vi.spyOn(listWorkbookVersionsUseCase, "execute").mockResolvedValue(success(versions));

      const workbookId = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.listWorkbookVersions.path, {
        id: workbookId,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ version: 2 })]),
      );
    });

    it("should return empty array for workbook with no versions", async () => {
      vi.spyOn(listWorkbookVersionsUseCase, "execute").mockResolvedValue(success([]));

      const workbookId = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.listWorkbookVersions.path, {
        id: workbookId,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return 500 when use case fails", async () => {
      vi.spyOn(listWorkbookVersionsUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const workbookId = faker.string.uuid();
      const path = testApp.resolvePath(contract.workbooks.listWorkbookVersions.path, {
        id: workbookId,
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getWorkbookVersion", () => {
    const mockVersion = (overrides?: Partial<WorkbookVersionDto>): WorkbookVersionDto => ({
      id: faker.string.uuid(),
      workbookId: faker.string.uuid(),
      version: 1,
      cells: [],
      metadata: {},
      createdAt: new Date(),
      createdBy: testUserId,
      ...overrides,
    });

    it("should return a specific version", async () => {
      const version = mockVersion();
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(success(version));

      const path = testApp.resolvePath(contract.workbooks.getWorkbookVersion.path, {
        id: version.workbookId,
        versionId: version.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: version.id,
        version: 1,
      });
    });

    it("should return 404 for non-existent version", async () => {
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Version not found")),
      );

      const path = testApp.resolvePath(contract.workbooks.getWorkbookVersion.path, {
        id: faker.string.uuid(),
        versionId: faker.string.uuid(),
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });
});
