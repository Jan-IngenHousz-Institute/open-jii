import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import {
  WORKBOOK_CAPABILITIES_HEADER,
  WORKBOOK_PARALLEL_CAPABILITY,
} from "@repo/api/domains/workbook/workbook-capabilities";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { assertSuccess, success, failure, AppError } from "../../common/utils/fp-utils";
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
import { WorkbookVersionRepository } from "../core/repositories/workbook-version.repository";

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

  const parallelCell = (): WorkbookCell => ({
    id: "parallel-1",
    type: "parallel",
    name: "device_lanes",
    isCollapsed: false,
    defaultLaneId: "lane-1",
    lanes: [
      {
        id: "lane-1",
        label: "Lane 1",
        color: "#005E5E",
        conditions: [],
        body: [{ id: "inside", type: "markdown", isCollapsed: false, content: "inside" }],
      },
    ],
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

    it("returns an empty 426 for container content when the header is absent", async () => {
      const version = mockVersion({ cells: [parallelCell()] });
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(success(version));
      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: version.workbookId,
        versionId: version.id,
      });

      const response = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.UPGRADE_REQUIRED);

      expect(response.text).toBe("");
      expect(response.body).toEqual({});
      expect(response.text).not.toContain("parallel-1");
      expect(response.text).not.toContain("inside");
    });

    it("returns container content only when the exact capability token is declared", async () => {
      const version = mockVersion({ cells: [parallelCell()] });
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(success(version));
      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: version.workbookId,
        versionId: version.id,
      });

      const response = await testApp
        .get(path)
        .set(WORKBOOK_CAPABILITIES_HEADER, WORKBOOK_PARALLEL_CAPABILITY)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ cells: [{ id: "parallel-1", type: "parallel" }] });
    });
  });

  // The pinned-version read is what the experiment design tab and the mobile flow
  // both depend on, and it is gated on the WORKBOOK — an experiment grant carries
  // nothing here. Runs against the real guard, so the mocked `can()` is restored.
  describe("getWorkbookVersion honours workbook visibility, not experiment access", () => {
    let granteeId: string;

    const versionFor = (workbookId: string): WorkbookVersionDto => ({
      id: faker.string.uuid(),
      workbookId,
      version: 1,
      cells: [],
      metadata: {},
      createdAt: new Date(),
      createdBy: testUserId,
    });

    beforeEach(async () => {
      vi.spyOn(testApp.module.get(AuthorizationService), "can").mockRestore();
      granteeId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Experiment with a workbook the grantee cannot read",
        userId: testUserId,
      });
      await testApp.addExperimentCollaborator(experiment.id, granteeId);
    });

    it("refuses a private workbook to an experiment collaborator who holds no grant on it", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Private workbook",
        createdBy: testUserId,
        visibility: "private",
      });
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(
        success(versionFor(workbook.id)),
      );

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: workbook.id,
        versionId: faker.string.uuid(),
      });
      await testApp.get(path).withAuth(granteeId).expect(StatusCodes.FORBIDDEN);
    });

    it("allows the same read once the workbook is public", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Public workbook",
        createdBy: testUserId,
        visibility: "public",
      });
      const version = versionFor(workbook.id);
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockResolvedValue(success(version));

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: workbook.id,
        versionId: version.id,
      });
      const response = await testApp.get(path).withAuth(granteeId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ id: version.id });
    });
  });

  /**
   * The route carries two ids and the guard only authorizes the workbook one, so the
   * version has to be looked up inside that workbook. Otherwise a caller could pair a
   * workbook they may read with a version id belonging to a private workbook they may
   * not, and be handed its cells and entity snapshots. Runs end to end against the
   * real use case and repository — mocking the use case would skip the lookup that
   * enforces this.
   */
  describe("getWorkbookVersion pairs the version with the workbook in the path", () => {
    const SECRET_CELL_TEXT = "private workbook cell content";
    const SECRET_SNAPSHOT_CODE = "private protocol snapshot code";

    let versionRepo: WorkbookVersionRepository;

    beforeEach(() => {
      versionRepo = testApp.module.get(WorkbookVersionRepository);
      vi.spyOn(testApp.module.get(AuthorizationService), "can").mockRestore();
      vi.spyOn(getWorkbookVersionUseCase, "execute").mockRestore();
    });

    /** A real version row, so the lookup runs against real data rather than a stub. */
    async function seedVersion(workbookId: string, cellText: string, snapshotCode: string) {
      const created = await versionRepo.create({
        workbookId,
        version: 1,
        cells: [{ id: "md1", type: "markdown", content: cellText, isCollapsed: false }],
        metadata: {},
        entitySnapshots: {
          protocols: {
            [faker.string.uuid()]: { code: [{ step: snapshotCode }], family: "multispeq" },
          },
          macros: {},
        },
        createdBy: testUserId,
      });
      assertSuccess(created);
      return created.value;
    }

    it("returns not-found for a version of a private workbook the caller cannot read", async () => {
      // A private workbook owned by somebody else, holding a version whose cells and
      // protocol snapshot are the content that must not escape.
      const strangerId = await testApp.createTestUser({});
      const privateWorkbook = await testApp.createWorkbook({
        name: "Private workbook holding a version",
        createdBy: strangerId,
        visibility: "private",
      });
      const secretVersion = await seedVersion(
        privateWorkbook.id,
        SECRET_CELL_TEXT,
        SECRET_SNAPSHOT_CODE,
      );

      // The workbook the caller is actually authorized for.
      const ownWorkbook = await testApp.createWorkbook({
        name: "Readable workbook",
        createdBy: testUserId,
      });

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: ownWorkbook.id,
        versionId: secretVersion.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);

      const body = JSON.stringify(response.body);
      expect(body).not.toContain(SECRET_CELL_TEXT);
      expect(body).not.toContain(SECRET_SNAPSHOT_CODE);
      expect(body).not.toContain(privateWorkbook.id);
    });

    it("serves the version when it does belong to the workbook in the path", async () => {
      const ownWorkbook = await testApp.createWorkbook({
        name: "Readable workbook with a version",
        createdBy: testUserId,
      });
      const version = await seedVersion(ownWorkbook.id, "mine", "my snapshot");

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbookVersion, {
        id: ownWorkbook.id,
        versionId: version.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ id: version.id, workbookId: ownWorkbook.id });
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
        name: "set workbook visibility",
        action: "manage",
        request: (id: string, userId: string) =>
          testApp
            .patch(testApp.resolveOrpcPath(contract.workbooks.setVisibility, { id }))
            .withAuth(userId)
            .send({ visibility: "public" }),
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
