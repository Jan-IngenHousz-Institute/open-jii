/**
 * Test data factories for creating realistic test objects.
 *
 * Each factory returns a valid default object. Pass partial overrides
 * to customise specific fields:
 *
 * @example
 * ```ts
 * const exp = createExperiment({ name: "My test", status: "archived" });
 * ```
 */
import type {
  Experiment,
  TransferRequest,
  ExperimentAccess,
  ExperimentDataResponse,
  ExportRecord,
  Flow,
  FlowGraph,
  Location,
  Macro,
  Protocol,
  UserProfile,
  ExperimentVisualization,
  ExperimentTableMetadata,
  PlaceSearchResult,
} from "@repo/api";

// ── Experiment ──────────────────────────────────────────────────

let experimentSeq = 0;

export function createExperiment(overrides: Partial<Experiment> = {}): Experiment {
  experimentSeq++;
  return {
    id: `exp-${experimentSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Experiment ${experimentSeq}`,
    description: `Description for experiment ${experimentSeq}`,
    status: "active",
    visibility: "private",
    createdBy: "user-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-15T00:00:00.000Z",
    embargoUntil: "2025-12-31T23:59:59.999Z",
    ownerFirstName: "John",
    ownerLastName: "Doe",
    ...overrides,
  };
}

// ── Transfer Request ────────────────────────────────────────────

let transferSeq = 0;

export function createTransferRequest(overrides: Partial<TransferRequest> = {}): TransferRequest {
  transferSeq++;
  return {
    requestId: `req-${transferSeq}-${crypto.randomUUID().slice(0, 8)}`,
    userId: "user-1",
    userEmail: "test@example.com",
    sourcePlatform: "photosynq",
    projectIdOld: `old-project-${transferSeq}`,
    projectUrlOld: `https://photosynq.com/projects/old-project-${transferSeq}`,
    status: "pending",
    requestedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Experiment Access ───────────────────────────────────────────

export function createExperimentAccess(
  overrides: Omit<Partial<ExperimentAccess>, "experiment"> & {
    experiment?: Partial<Experiment>;
  } = {},
): ExperimentAccess {
  const { experiment: experimentOverrides, ...accessOverrides } = overrides;
  return {
    experiment: createExperiment(experimentOverrides),
    hasAccess: true,
    isAdmin: false,
    ...accessOverrides,
  };
}

// ── Session / Auth ──────────────────────────────────────────────

export function createSession(
  overrides: Partial<{
    user: {
      id: string;
      name: string;
      email: string;
      registered: boolean;
      firstName: string;
      lastName: string;
    };
  }> = {},
) {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      registered: true,
      firstName: "Test",
      lastName: "User",
      ...overrides.user,
    },
  };
}

// ── Macro ───────────────────────────────────────────────────────

let macroSeq = 0;

export function createMacro(overrides: Partial<Macro> = {}): Macro {
  macroSeq++;
  return {
    id: `macro-${macroSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Macro ${macroSeq}`,
    filename: `macro_${macroSeq}.py`,
    description: `Description for macro ${macroSeq}`,
    language: "python",
    code: 'print("hello")',
    sortOrder: null,
    createdBy: "user-1",
    createdByName: "Test User",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
    ...overrides,
  };
}

// ── Protocol ────────────────────────────────────────────────────

let protocolSeq = 0;

export function createProtocol(overrides: Partial<Protocol> = {}): Protocol {
  protocolSeq++;
  return {
    id: `protocol-${protocolSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Protocol ${protocolSeq}`,
    description: `Description for protocol ${protocolSeq}`,
    code: [{ _protocol_set_: [] }],
    family: "multispeq",
    sortOrder: null,
    createdBy: "user-1",
    createdByName: "Test User",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
    ...overrides,
  };
}

// ── User Profile ────────────────────────────────────────────────

export function createUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: "user-1",
    firstName: "Test",
    lastName: "User",
    bio: null,
    organization: undefined,
    activated: true,
    email: "test@example.com",
    ...overrides,
  };
}

// ── Experiment Visualization ────────────────────────────────────

let vizSeq = 0;

export function createVisualization(
  overrides: Partial<ExperimentVisualization> = {},
): ExperimentVisualization {
  vizSeq++;
  return {
    id: `viz-${vizSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Visualization ${vizSeq}`,
    description: `Description for visualization ${vizSeq}`,
    experimentId: "exp-1",
    chartFamily: "basic",
    chartType: "line",
    config: {},
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { tableName: "test_table", columnName: "time", role: "x" },
        { tableName: "test_table", columnName: "value", role: "y" },
      ],
    },
    createdBy: "user-1",
    createdByName: "Test User",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z",
    ...overrides,
  };
}

// ── Experiment Table Metadata ───────────────────────────────────

let tableSeq = 0;

export function createExperimentTable(
  overrides: Partial<ExperimentTableMetadata> = {},
): ExperimentTableMetadata {
  tableSeq++;
  return {
    name: `table_${tableSeq}`,
    displayName: `Table ${tableSeq}`,
    totalRows: 100,
    defaultSortColumn: undefined,
    errorColumn: undefined,
    ...overrides,
  };
}

// ── Place Search Result ─────────────────────────────────────────

let placeSeq = 0;

export function createPlace(overrides: Partial<PlaceSearchResult> = {}): PlaceSearchResult {
  placeSeq++;
  return {
    label: `Place ${placeSeq}`,
    latitude: 52.52,
    longitude: 13.405,
    country: undefined,
    region: undefined,
    municipality: undefined,
    postalCode: undefined,
    ...overrides,
  };
}

// ── Location ────────────────────────────────────────────────────

let locationSeq = 0;

export function createLocation(overrides: Partial<Location> = {}): Location {
  locationSeq++;
  return {
    id: `loc-${locationSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Location ${locationSeq}`,
    latitude: 42.36 + locationSeq * 0.01,
    longitude: -71.06 + locationSeq * 0.01,
    country: "US",
    region: "Massachusetts",
    municipality: "Boston",
    postalCode: undefined,
    addressLabel: undefined,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Experiment Data Table (with data) ───────────────────────────

type ExperimentDataTable = ExperimentDataResponse[number];

let dataTableSeq = 0;

export function createExperimentDataTable(
  overrides: Partial<ExperimentDataTable> = {},
): ExperimentDataTable {
  dataTableSeq++;
  return {
    name: `table_${dataTableSeq}`,
    catalog_name: "catalog",
    schema_name: "schema",
    totalRows: 2,
    page: 1,
    pageSize: 100,
    totalPages: 1,
    data: {
      columns: [
        { name: "time", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        { time: 1, value: 10 },
        { time: 2, value: 20 },
      ],
      totalRows: 2,
      truncated: false,
    },
    ...overrides,
  };
}

// ── Flow ────────────────────────────────────────────────────────

type FlowNode = FlowGraph["nodes"][number];

let flowSeq = 0;

export function createFlowNode(
  overrides: Partial<FlowNode> & { type?: FlowNode["type"]; content?: FlowNode["content"] } = {},
): FlowNode {
  flowSeq++;
  const type = overrides.type ?? "instruction";
  const content =
    overrides.content ??
    (type === "measurement"
      ? { protocolId: crypto.randomUUID() }
      : type === "analysis"
        ? { macroId: crypto.randomUUID() }
        : { text: `Step ${flowSeq}` });

  return {
    id: `node-${flowSeq}`,
    type,
    name: `Node ${flowSeq}`,
    content,
    isStart: false,
    ...overrides,
  };
}

export function createFlow(
  overrides: Partial<Omit<Flow, "graph">> & { graph?: Partial<FlowGraph> } = {},
): Flow {
  const { graph: graphOverrides, ...rest } = overrides;
  const defaultNode = createFlowNode({ isStart: true });
  return {
    id: crypto.randomUUID(),
    experimentId: "exp-1",
    graph: {
      nodes: [defaultNode],
      edges: [],
      ...graphOverrides,
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...rest,
  };
}

// ── ExportRecord ────────────────────────────────────────────────

let exportSeq = 0;

export function createExportRecord(overrides: Partial<ExportRecord> = {}): ExportRecord {
  exportSeq++;
  return {
    exportId: `export-${exportSeq}-${crypto.randomUUID().slice(0, 8)}`,
    experimentId: "exp-1",
    tableName: "raw_data",
    format: "csv",
    status: "completed",
    filePath: `/exports/export-${exportSeq}.csv`,
    rowCount: 100,
    fileSize: 1024,
    createdBy: "user-1",
    createdAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:05:00Z",
    ...overrides,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

/** Reset sequence counters — useful in beforeEach if deterministic IDs matter */
export function resetFactories() {
  experimentSeq = 0;
  transferSeq = 0;
  macroSeq = 0;
  protocolSeq = 0;
  vizSeq = 0;
  tableSeq = 0;
  placeSeq = 0;
  locationSeq = 0;
  dataTableSeq = 0;
  flowSeq = 0;
  exportSeq = 0;
}
