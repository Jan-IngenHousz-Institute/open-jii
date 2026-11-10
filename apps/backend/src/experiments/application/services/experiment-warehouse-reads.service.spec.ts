import { assertSuccess, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { ExperimentTableMetadata } from "../../core/models/experiment-data.model";
import type { FlowGraphDto } from "../../core/models/flow.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { FlowRepository } from "../../core/repositories/flow.repository";
import { ExperimentWarehouseReadsService } from "./experiment-warehouse-reads.service";

describe("ExperimentWarehouseReadsService", () => {
  const testApp = TestHarness.App;
  let reads: ExperimentWarehouseReadsService;
  let databricksPort: DatabricksPort;
  let flows: FlowRepository;
  let experimentId: string;

  const rawData: ExperimentTableMetadata = {
    identifier: "raw_data",
    tableType: "static",
    displayName: null,
    rowCount: 3,
    latestRowAt: null,
    schemaRevision: "r1",
    questionsSchema: "OBJECT<height: STRING, plot: STRING>",
  };

  const graph: FlowGraphDto = {
    nodes: [
      {
        id: "q1",
        type: "question",
        name: "Height",
        content: { kind: "number", text: "Plant height", required: false },
        isStart: true,
      },
      {
        id: "q2",
        type: "question",
        name: "Plot",
        content: { kind: "open_ended", text: "Plot ID", required: false },
        isStart: false,
      },
    ],
    edges: [{ id: "e1", source: "q1", target: "q2" }],
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    reads = testApp.module.get(ExperimentWarehouseReadsService);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    flows = testApp.module.get(FlowRepository);
    const userId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Heights", userId });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function metadata(tables: ExperimentTableMetadata[]) {
    vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(tables));
  }

  it("reads a Number question as DOUBLE and leaves the other questions as text", async () => {
    assertSuccess(await flows.create(experimentId, graph));
    metadata([rawData]);

    const result = await reads.tablesMetadata(experimentId);

    assertSuccess(result);
    expect(result.value[0].questionsSchema).toBe("OBJECT<height: DOUBLE, plot: STRING>");
  });

  it("moves the schema revision with the typed keys, so cached column lists refresh", async () => {
    assertSuccess(await flows.create(experimentId, graph));
    metadata([rawData]);

    const result = await reads.tablesMetadata(experimentId);

    assertSuccess(result);
    expect(result.value[0].schemaRevision).toMatch(/^r1:[0-9a-f]{32}$/);
  });

  it("leaves a table whose answers hold no Number question as it is", async () => {
    assertSuccess(await flows.create(experimentId, graph));
    const other = { ...rawData, questionsSchema: "OBJECT<plot: STRING>" };
    metadata([other]);

    const result = await reads.tablesMetadata(experimentId);

    assertSuccess(result);
    expect(result.value[0]).toEqual(other);
  });

  it("leaves the metadata as it is when the experiment has no flow", async () => {
    metadata([rawData]);

    const result = await reads.tablesMetadata(experimentId);

    assertSuccess(result);
    expect(result.value[0]).toEqual(rawData);
  });

  it("matches a question to its column by the pipeline's key", async () => {
    const renamed: FlowGraphDto = {
      ...graph,
      nodes: [{ ...graph.nodes[0], name: "Plant  Height (cm)" }, graph.nodes[1]],
    };
    assertSuccess(await flows.create(experimentId, renamed));
    metadata([{ ...rawData, questionsSchema: "OBJECT<plant_height_cm: STRING, plot: STRING>" }]);

    const result = await reads.tablesMetadata(experimentId);

    assertSuccess(result);
    expect(result.value[0].questionsSchema).toBe("OBJECT<plant_height_cm: DOUBLE, plot: STRING>");
  });
});
