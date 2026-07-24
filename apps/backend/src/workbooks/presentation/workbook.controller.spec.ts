import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { AuthorizationService } from "../../authorization/authorization.service";
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
    // Authorization is enforced by the @CanAccess route guard against the real
    // DB; these controller tests mock the use-cases with synthetic ids, so allow
    // the guard here. Guard behavior itself is covered by authorization.service.spec.
    vi.spyOn(testApp.module.get(AuthorizationService), "can").mockResolvedValue({
      allow: true,
      reason: "org-role",
    });
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
    organizationId: null,
    visibility: "public",
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
        .post(testApp.resolveOrpcPath(contract.workbooks.createWorkbook))
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
        .post(testApp.resolveOrpcPath(contract.workbooks.createWorkbook))
        .withAuth(testUserId)
        .send({ description: "No name" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 500 when use case fails", async () => {
      vi.spyOn(createWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .post(testApp.resolveOrpcPath(contract.workbooks.createWorkbook))
        .withAuth(testUserId)
        .send({ name: "Test" })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should return 401 without auth", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.workbooks.createWorkbook))
        .withoutAuth()
        .send({ name: "Test" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getWorkbook", () => {
    it("should return a workbook by ID", async () => {
      const mock = mockWorkbook();
      vi.spyOn(getWorkbookUseCase, "execute").mockResolvedValue(success(mock));

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbook, { id: mock.id });
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
      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbook, { id });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listWorkbooks", () => {
    it("should return a list of workbooks", async () => {
      const mocks = [mockWorkbook(), mockWorkbook({ name: "Second Workbook" })];
      vi.spyOn(listWorkbooksUseCase, "execute").mockResolvedValue(success(mocks));

      const response = await testApp
        .get(testApp.resolveOrpcPath(contract.workbooks.listWorkbooks))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
    });

    it("should pass search and filter to use case", async () => {
      const executeSpy = vi.spyOn(listWorkbooksUseCase, "execute").mockResolvedValue(success([]));

      await testApp
        .get(testApp.resolveOrpcPath(contract.workbooks.listWorkbooks))
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
        .get(testApp.resolveOrpcPath(contract.workbooks.listWorkbooks))
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("updateWorkbook", () => {
    it("should update a workbook", async () => {
      // Create a real workbook owned by the caller so the @CanAccess guard
      // (which resolves ownership from the DB) authorizes the request.
      const workbook = await testApp.createWorkbook({ name: "Original", createdBy: testUserId });
      const mock = mockWorkbook({ id: workbook.id, name: "Updated Name" });
      vi.spyOn(updateWorkbookUseCase, "execute").mockResolvedValue(success(mock));

      const path = testApp.resolveOrpcPath(contract.workbooks.updateWorkbook, { id: workbook.id });
      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ name: "Updated Name" })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ name: "Updated Name" });
    });

    it("should return 404 for non-existent workbook", async () => {
      vi.spyOn(updateWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook not found")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.workbooks.updateWorkbook, { id });
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ name: "Nope" })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("deleteWorkbook", () => {
    it("should delete a workbook", async () => {
      // Create a real workbook owned by the caller so the @CanAccess guard
      // (which resolves ownership from the DB) authorizes the request.
      const workbook = await testApp.createWorkbook({ name: "WB", createdBy: testUserId });
      vi.spyOn(deleteWorkbookUseCase, "execute").mockResolvedValue(success(undefined));

      const path = testApp.resolveOrpcPath(contract.workbooks.deleteWorkbook, { id: workbook.id });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);
    });

    it("should return 404 for non-existent workbook", async () => {
      vi.spyOn(deleteWorkbookUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Workbook not found")),
      );

      const id = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.workbooks.deleteWorkbook, { id });
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
      const path = testApp.resolveOrpcPath(contract.workbooks.listWorkbookVersions, {
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
      const path = testApp.resolveOrpcPath(contract.workbooks.listWorkbookVersions, {
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
      const path = testApp.resolveOrpcPath(contract.workbooks.listWorkbookVersions, {
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

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
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

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: faker.string.uuid(),
        versionId: faker.string.uuid(),
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("passes clientSupportsDynamicRef=true when the capability header is present", async () => {
      const version = mockVersion();
      const executeSpy = vi
        .spyOn(getWorkbookVersionUseCase, "execute")
        .mockResolvedValue(success(version));

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: version.workbookId,
        versionId: version.id,
      });
      await testApp
        .get(path)
        .withAuth(testUserId)
        .set("x-openjii-capabilities", "dynamic-command-ref-v1")
        .expect(StatusCodes.OK);

      expect(executeSpy).toHaveBeenCalledWith(version.id, { clientSupportsDynamicRef: true });
    });

    it("passes clientSupportsDynamicRef=false when the capability header is absent", async () => {
      const version = mockVersion();
      const executeSpy = vi
        .spyOn(getWorkbookVersionUseCase, "execute")
        .mockResolvedValue(success(version));

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: version.workbookId,
        versionId: version.id,
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(executeSpy).toHaveBeenCalledWith(version.id, { clientSupportsDynamicRef: false });
    });

    it("maps an upgrade-required refusal to HTTP 426", async () => {
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(
        failure(
          AppError.upgradeRequired(
            "This workbook version requires a newer client to open",
            "DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED",
          ),
        ),
      );

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: faker.string.uuid(),
        versionId: faker.string.uuid(),
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.UPGRADE_REQUIRED);
    });

    it("returns a 426 body with a stable code and no workbook cells in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(
        failure(
          AppError.upgradeRequired(
            "This workbook version requires a newer client to open",
            "DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED",
          ),
        ),
      );

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: faker.string.uuid(),
        versionId: faker.string.uuid(),
      });
      const response = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.UPGRADE_REQUIRED);

      const serialized = JSON.stringify(response.body);
      expect(serialized).toContain("DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED");
      expect(serialized).not.toContain('"cells"');
      vi.unstubAllEnvs();
    });
  });

  describe("authorization", () => {
    // Each guarded route must delegate to AuthorizationService.can() with the
    // resource/action declared by its @CanAccess decorator, and turn a denial
    // into a 403. Mocking can() to deny keeps this independent of the guard's
    // internal DB logic (covered by authorization.service.spec) and pins the
    // {resource, action} wiring, so a missing or wrong-action decorator fails
    // here.
    it.each([
      {
        name: "get workbook",
        action: "read",
        request: (id: string, userId: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.workbooks.getWorkbook, { id }))
            .withAuth(userId),
      },
      {
        name: "update workbook",
        action: "update",
        request: (id: string, userId: string) =>
          testApp
            .patch(testApp.resolveOrpcPath(contract.workbooks.updateWorkbook, { id }))
            .withAuth(userId)
            .send({ name: "Blocked update" }),
      },
      {
        name: "delete workbook",
        action: "manage",
        request: (id: string, userId: string) =>
          testApp
            .delete(testApp.resolveOrpcPath(contract.workbooks.deleteWorkbook, { id }))
            .withAuth(userId),
      },
      {
        name: "list workbook versions",
        action: "read",
        request: (id: string, userId: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.workbooks.listWorkbookVersions, { id }))
            .withAuth(userId),
      },
      {
        name: "get workbook version",
        action: "read",
        request: (id: string, userId: string) =>
          testApp
            .get(
              testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
                id,
                versionId: faker.string.uuid(),
              }),
            )
            .withAuth(userId),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const canSpy = vi
        .spyOn(testApp.module.get(AuthorizationService), "can")
        .mockResolvedValue({ allow: false, reason: "forbidden" });
      const workbookId = faker.string.uuid();

      await request(workbookId, testUserId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledWith(testUserId, {
        resourceType: "workbook",
        resourceId: workbookId,
        action,
      });
    });

    it("returns 403 when creating a workbook in an organization the caller is not a member of", async () => {
      const organizationId = faker.string.uuid();
      const isOrgMemberSpy = vi
        .spyOn(testApp.module.get(AuthorizationService), "isOrgMember")
        .mockResolvedValue(false);

      await testApp
        .post(testApp.resolveOrpcPath(contract.workbooks.createWorkbook))
        .withAuth(testUserId)
        .send({ name: "Org workbook", organizationId })
        .expect(StatusCodes.FORBIDDEN);

      expect(isOrgMemberSpy).toHaveBeenCalledWith(testUserId, organizationId);
    });
  });
});
