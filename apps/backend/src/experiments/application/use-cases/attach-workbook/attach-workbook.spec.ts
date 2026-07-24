import { Logger } from "@nestjs/common";

import {
  assertFailure,
  assertSuccess,
  failure,
  AppError,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { GetFlowUseCase } from "../flows/get-flow";
import { AttachWorkbookUseCase } from "./attach-workbook";

describe("AttachWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: AttachWorkbookUseCase;
  let flowRepo: FlowRepository;
  let adminUserId: string;
  let experimentId: string;
  let workbookId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AttachWorkbookUseCase);
    flowRepo = testApp.module.get(FlowRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: adminUserId,
    });
    workbookId = workbook.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("rolls back the pointer AND writes no flow when the flow upsert fails", async () => {
    const experimentRepo = testApp.module.get(ExperimentRepository);
    vi.spyOn(flowRepo, "upsert").mockResolvedValue(failure(AppError.internal("flow upsert boom")));

    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertFailure(result);

    // Pointer rolled back (still unattached) and no flow row written.
    const after = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(after);
    expect(after.value.experiment?.workbookVersionId).toBeNull();
    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).toBeNull();
  });

  it("rolls back and writes nothing when the pointer update fails", async () => {
    const experimentRepo = testApp.module.get(ExperimentRepository);
    vi.spyOn(experimentRepo, "update").mockResolvedValue(
      failure(AppError.internal("pointer boom")),
    );

    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertFailure(result);

    const after = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(after);
    expect(after.value.experiment?.workbookVersionId).toBeNull();
    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).toBeNull();
  });

  it("attaching an empty workbook sets the pointer but stores no flow row (GET 404)", async () => {
    const empty = await testApp.createWorkbook({
      name: "Empty",
      cells: [],
      createdBy: adminUserId,
    });

    const result = await useCase.execute(experimentId, empty.id, adminUserId);
    assertSuccess(result);
    expect(result.value.workbookId).toBe(empty.id);

    // No flow row materialized for a node-less workbook.
    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).toBeNull();

    // GET flow then follows the existing not-found path.
    const getFlow = testApp.module.get(GetFlowUseCase);
    const read = await getFlow.execute(experimentId, adminUserId);
    assertFailure(read);
    expect(read.error.statusCode).toBe(404);
  });

  it("rejects a stale expected-workbook (concurrent change) with a rolled-back conflict", async () => {
    const experimentRepo = testApp.module.get(ExperimentRepository);
    // Simulate a concurrent change: the use case observes a workbook id that no
    // longer matches the (still-null) row when the bind locks it.
    const found = await experimentRepo.findOne(experimentId);
    assertSuccess(found);
    const observed = found.value;
    if (!observed) throw new Error("expected experiment in test setup");
    vi.spyOn(experimentRepo, "findOne").mockResolvedValue(
      success({ ...observed, workbookId: "stale-workbook-id" }),
    );

    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
    expect(result.error.code).toBe("FLOW_BIND_WORKBOOK_CONFLICT");

    // Pointer + flow unchanged.
    vi.restoreAllMocks();
    const after = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(after);
    expect(after.value.experiment?.workbookId).toBeNull();
    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).toBeNull();
  });

  it("sanitizes spoofed safe-code failures and never logs repository secrets", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    vi.spyOn(flowRepo, "upsert").mockResolvedValue(
      failure(
        AppError.repositoryError("SENTINEL_REPOSITORY_SECRET", "FLOW_BIND_WORKBOOK_CONFLICT", {
          graph: "SENTINEL_GRAPH_SECRET",
          cells: "SENTINEL_CELL_SECRET",
        }),
      ),
    );

    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertFailure(result);
    expect(result.error.code).toBe("FLOW_BIND_FAILED");
    expect(result.error.message).toBe("Failed to bind the workbook version and flow");
    expect(JSON.stringify(result.error)).not.toContain("SENTINEL");
    expect(loggerSpy).toHaveBeenCalled();
    expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain("SENTINEL");
    vi.unstubAllEnvs();
  });

  it("attaches a workbook and creates version 1", async () => {
    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);
    expect(result.value.workbookId).toBe(workbookId);
    expect(result.value.version).toBe(1);
    expect(result.value.workbookVersionId).toBeDefined();
  });

  it("returns a controlled failure and persists no flow when materialization is invalid", async () => {
    // Duplicate cell ids materialize into duplicate node ids => strict fail.
    const dupWorkbook = await testApp.createWorkbook({
      name: "Dup",
      cells: [
        { id: "dup", type: "markdown", content: "a", isCollapsed: false },
        { id: "dup", type: "markdown", content: "b", isCollapsed: false },
      ],
      createdBy: adminUserId,
    });
    const upsertSpy = vi.spyOn(flowRepo, "upsert");

    const result = await useCase.execute(experimentId, dupWorkbook.id, adminUserId);

    assertFailure(result);
    expect(result.error.code).toBe("FLOW_MATERIALIZATION_FAILED");
    expect(upsertSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("returns failure when experiment not found", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      workbookId,
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when workbook not found", async () => {
    const result = await useCase.execute(
      experimentId,
      "00000000-0000-0000-0000-000000000000",
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("reuses version when attaching same workbook again with unchanged cells", async () => {
    const first = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(first);

    const second = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(second);

    expect(second.value.workbookVersionId).toBe(first.value.workbookVersionId);
    expect(second.value.version).toBe(1);
  });

  it("materialises a flow row from the version's cells (mobile backward compat)", async () => {
    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);

    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).not.toBeNull();
    expect(flow.value?.graph.nodes).toHaveLength(1);
    expect(flow.value?.graph.nodes[0]).toMatchObject({ id: "md1", type: "instruction" });
    expect(flow.value?.graph.edges).toHaveLength(0);
  });
});
