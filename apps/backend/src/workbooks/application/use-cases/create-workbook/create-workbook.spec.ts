import { ensurePersonalOrganization, organizationMembers, organizations } from "@repo/database";

import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { CreateWorkbookUseCase } from "./create-workbook";

describe("CreateWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateWorkbookUseCase;
  let repo: WorkbookRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateWorkbookUseCase);
    repo = testApp.module.get(WorkbookRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("creates a workbook with minimal fields", async () => {
    const result = await useCase.execute({ name: "My Workbook" }, userId);
    assertSuccess(result);
    expect(result.value.name).toBe("My Workbook");
    expect(result.value.createdBy).toBe(userId);
    expect(result.value.cells).toEqual([]);
    expect(result.value.metadata).toEqual({});
  });

  it("assigns the target organization to the workbook", async () => {
    const [targetOrganization] = await testApp.database
      .insert(organizations)
      .values({ name: "Target Workbook Organization", slug: `target-${userId}` })
      .returning();
    await testApp.database.insert(organizationMembers).values({
      organizationId: targetOrganization.id,
      userId,
      role: "owner",
    });

    const result = await useCase.execute(
      { name: "Target Organization Workbook" },
      userId,
      targetOrganization.id,
    );

    assertSuccess(result);
    expect(result.value.organizationId).toBe(targetOrganization.id);
  });

  it("falls back to the creator's personal organization when no target is provided", async () => {
    const result = await useCase.execute({ name: "Personal Organization Workbook" }, userId, null);
    const personalOrganizationId = await ensurePersonalOrganization(testApp.database, {
      id: userId,
    });

    assertSuccess(result);
    expect(result.value.organizationId).toBe(personalOrganizationId);
  });

  it("creates a workbook with all fields", async () => {
    const result = await useCase.execute(
      {
        name: "Full Workbook",
        description: "A complete workbook",
        cells: [{ id: "md1", type: "markdown", content: "Hello" }],
        metadata: { version: 1 },
      },
      userId,
    );
    assertSuccess(result);
    expect(result.value.name).toBe("Full Workbook");
    expect(result.value.description).toBe("A complete workbook");
    expect(result.value.cells).toEqual([{ id: "md1", type: "markdown", content: "Hello" }]);
    expect(result.value.metadata).toEqual({ version: 1 });
  });

  it("assigns a unique id to the created workbook", async () => {
    const r1 = await useCase.execute({ name: "WB 1" }, userId);
    const r2 = await useCase.execute({ name: "WB 2" }, userId);
    assertSuccess(r1);
    assertSuccess(r2);
    expect(r1.value.id).not.toBe(r2.value.id);
  });

  it("returns failure when repository create fails", async () => {
    vi.spyOn(repo, "create").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute({ name: "WB" }, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  it("returns failure when repository returns empty array", async () => {
    vi.spyOn(repo, "create").mockResolvedValue(success([]));
    const result = await useCase.execute({ name: "WB" }, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });
});
