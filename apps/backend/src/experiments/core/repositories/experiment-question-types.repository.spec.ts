import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { eq, experiments, experimentQuestionTypes } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { PublishVersionUseCase } from "../../../workbooks/application/use-cases/publish-version/publish-version";
import { WorkbookRepository } from "../../../workbooks/core/repositories/workbook.repository";
import { AttachWorkbookUseCase } from "../../application/use-cases/attach-workbook/attach-workbook";
import { UpgradeWorkbookVersionUseCase } from "../../application/use-cases/upgrade-workbook-version/upgrade-workbook-version";
import { ExperimentQuestionTypesRepository } from "./experiment-question-types.repository";
import { ExperimentRepository } from "./experiment.repository";
import { FlowRepository } from "./flow.repository";

const question = (kind: "number" | "open_ended", name = "Height"): WorkbookCell => ({
  id: "height",
  type: "question",
  name,
  question: { kind, text: "Height?", required: false },
  isCollapsed: false,
  isAnswered: false,
});

describe("experiment question types", () => {
  const app = TestHarness.App;
  let userId: string;
  let experimentId: string;
  let workbookId: string;
  let registry: ExperimentQuestionTypesRepository;
  let workbooks: WorkbookRepository;

  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    userId = await app.createTestUser({});
    experimentId = (await app.createExperiment({ userId, name: "Numeric questions" })).experiment
      .id;
    workbookId = (
      await app.createWorkbook({ createdBy: userId, name: "Heights", cells: [question("number")] })
    ).id;
    registry = app.module.get(ExperimentQuestionTypesRepository);
    workbooks = app.module.get(WorkbookRepository);
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  const attach = () =>
    app.module.get(AttachWorkbookUseCase).execute(experimentId, workbookId, userId);
  const upgrade = () => app.module.get(UpgradeWorkbookVersionUseCase).execute(experimentId, userId);

  it("does not activate an unproven historical Number on pin", async () => {
    assertSuccess(await attach());
    const active = await registry.activeNumericKeys(experimentId);
    assertSuccess(active);
    expect(active.value).toEqual([]);
  });

  it("activates fresh tracked questions and keeps their declarations after removal", async () => {
    await app.database
      .update(experiments)
      .set({ questionTypesTracked: true })
      .where(eq(experiments.id, experimentId));
    assertSuccess(await attach());
    const active = await registry.activeNumericKeys(experimentId);
    assertSuccess(active);
    expect(active.value).toEqual(["height"]);
    await workbooks.update(workbookId, { cells: [] });
    assertSuccess(await upgrade());
    await workbooks.update(workbookId, { cells: [question("open_ended")] });
    const refused = await upgrade();
    assertFailure(refused);
    expect(refused.error.message).toContain("new name");
    const flow = await app.module.get(FlowRepository).getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value?.graph.nodes).toEqual([]);
    await workbooks.update(workbookId, { cells: [question("open_ended", "Height note")] });
    assertSuccess(await upgrade());
  });

  it("guards a different workbook and leaves the flow and pin unchanged on failure", async () => {
    const first = await attach();
    assertSuccess(first);
    const other = await app.createWorkbook({
      createdBy: userId,
      name: "Text heights",
      cells: [question("open_ended", "height")],
    });
    const refused = await app.module
      .get(AttachWorkbookUseCase)
      .execute(experimentId, other.id, userId);
    assertFailure(refused);
    const stored = await app.module.get(ExperimentRepository).findOne(experimentId);
    assertSuccess(stored);
    expect(stored.value?.workbookVersionId).toBe(first.value.workbookVersionId);
  });

  it("serializes concurrent incompatible pins", async () => {
    const text = await app.createWorkbook({
      createdBy: userId,
      name: "Text",
      cells: [question("open_ended")],
    });
    const publish = app.module.get(PublishVersionUseCase);
    const numberVersion = await publish.execute(workbookId, userId);
    const textVersion = await publish.execute(text.id, userId);
    assertSuccess(numberVersion);
    assertSuccess(textVersion);
    const results = await Promise.all([
      registry.pinVersion(experimentId, numberVersion.value),
      registry.pinVersion(experimentId, textVersion.value),
    ]);
    expect(results.filter((result) => result.isSuccess())).toHaveLength(1);
    expect(results.filter((result) => result.isFailure())).toHaveLength(1);
  });

  it("keeps legacy collisions readable while allowing a corrected workbook pin", async () => {
    const legacy = [question("number", "a__b"), { ...question("open_ended", "a_b"), id: "second" }];
    await workbooks.update(workbookId, { cells: legacy });
    const publish = app.module.get(PublishVersionUseCase);
    const previous = await publish.execute(workbookId, userId);
    assertSuccess(previous);
    assertSuccess(await registry.pinVersion(experimentId, previous.value, true));
    await workbooks.update(workbookId, {
      cells: [question("number", "a__b"), { ...question("open_ended", "Leaf note"), id: "second" }],
    });
    assertSuccess(await upgrade());
    const active = await registry.activeNumericKeys(experimentId);
    assertSuccess(active);
    expect(active.value).toEqual([]);
  });

  it("returns not found and rolls back declarations when an updated flow does not exist", async () => {
    const result = await registry.saveFlow(
      experimentId,
      {
        nodes: [
          {
            id: "height",
            type: "question",
            name: "Height",
            content: { kind: "number", text: "Height?", required: false },
            isStart: true,
          },
        ],
        edges: [],
      },
      "update",
    );
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toBe("Flow not found");
    expect(
      await app.database
        .select()
        .from(experimentQuestionTypes)
        .where(eq(experimentQuestionTypes.experimentId, experimentId)),
    ).toEqual([]);
  });

  it("rejects canonical collisions and checks direct flow edits too", async () => {
    await workbooks.update(workbookId, {
      cells: [question("number", "a__b"), { ...question("open_ended", "a b"), id: "second" }],
    });
    const collision = await attach();
    assertFailure(collision);
    expect(collision.error.code).toBe("DUPLICATE_QUESTION_KEY");
    await workbooks.update(workbookId, { cells: [question("number")] });
    assertSuccess(await attach());
    const result = await app.module.get(FlowRepository).update(experimentId, {
      nodes: [
        {
          id: "height",
          type: "question",
          name: "Height",
          content: { kind: "open_ended", text: "Height?", required: false },
          isStart: true,
        },
      ],
      edges: [],
    });
    assertFailure(result);
  });
});
