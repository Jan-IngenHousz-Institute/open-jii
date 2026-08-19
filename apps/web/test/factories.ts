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
import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";
import type {
  DeviceGroupDetail,
  DeviceGroupListItem,
  DeviceGroupMember,
} from "@repo/api/domains/device-group/device-group.schema";
import type {
  ExperimentDashboardLayout,
  ExperimentDashboardWidget,
  ExperimentDashboard,
  ExperimentFilterWidget,
  ExperimentRichTextWidget,
  ExperimentTableWidget,
  ExperimentVisualizationWidget,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import type {
  ExperimentDataResponse,
  ExperimentTableMetadata,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  Experiment,
  ExperimentAccess,
  ExperimentExportRecord,
  ExperimentFlowGraph,
  ExperimentUploadMetadata,
} from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentFlow } from "@repo/api/domains/experiment/flows/experiment-flows.schema";
import type {
  ExperimentLocation,
  ExperimentPlaceSearchResult,
} from "@repo/api/domains/experiment/locations/experiment-locations.schema";
import type { ExperimentTransferRequest } from "@repo/api/domains/experiment/transfer-requests/experiment-transfer-requests.schema";
import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { IotDeviceDetail, IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
import type { Macro, MacroDetail } from "@repo/api/domains/macro/macro.schema";
import type { OrganizationJoinRequest } from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";
import type {
  MyOrganization,
  OrganizationDirectoryEntry,
  OrganizationMember,
  OrganizationProfile,
  OrganizationResource,
  OrganizationTeam,
  OrganizationTeamGrant,
} from "@repo/api/domains/organization/organization.schema";
import type { Protocol, ProtocolDetail } from "@repo/api/domains/protocol/protocol.schema";
import type {
  GranteeUserDto,
  ResourceGrantDto,
  ResourceOwnerDto,
} from "@repo/api/domains/sharing/sharing.schema";
import type { Invitation, UserProfile } from "@repo/api/domains/user/user.schema";
import type {
  BranchCell,
  CommandCell,
  MacroCell,
  MarkdownCell,
  OutputCell,
  ProtocolCell,
  QuestionCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import type { WorkbookVersionSummary } from "@repo/api/domains/workbook/workbook-version.schema";
import type { Workbook, WorkbookDetail } from "@repo/api/domains/workbook/workbook.schema";
import type { Session } from "@repo/auth/types";

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
    anonymizeContributors: false,
    workbookId: null,
    workbookVersionId: null,
    organizationId: null,
    ownerFirstName: "John",
    ownerLastName: "Doe",
    ...overrides,
  };
}

// ── Transfer Request ────────────────────────────────────────────

let transferSeq = 0;

export function createTransferRequest(
  overrides: Partial<ExperimentTransferRequest> = {},
): ExperimentTransferRequest {
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
    capabilities: {
      canContribute: false,
      canUpdate: false,
      canManage: false,
      canShare: false,
      canLeave: false,
      canTransfer: false,
    },
    ...accessOverrides,
  };
}

// ── Session / Auth ──────────────────────────────────────────────

export function createSession(
  overrides: {
    user?: Partial<NonNullable<Session>["user"]>;
    session?: Partial<NonNullable<Session>["session"]>;
  } = {},
): NonNullable<Session> {
  // Resolve the user first so the session's `userId` follows a caller's
  // `user.id` override automatically. Without this, tests that override
  // only one of the two would silently produce inconsistent fixtures.
  const user: NonNullable<Session>["user"] = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    image: null,
    registered: true,
    ...overrides.user,
  };
  return {
    user,
    session: {
      id: "session-1",
      userId: user.id,
      token: "test-token",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      ipAddress: null,
      userAgent: null,
      ...overrides.session,
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
    forkedFrom: null,
    organizationId: null,
    visibility: "public",
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
    forkedFrom: null,
    organizationId: null,
    visibility: "public",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
    ...overrides,
  };
}

let workbookSeq = 0;

export function createWorkbook(overrides: Partial<Workbook> = {}): Workbook {
  workbookSeq++;
  return {
    id: crypto.randomUUID(),
    name: `Workbook ${workbookSeq}`,
    description: `Description for workbook ${workbookSeq}`,
    cells: [],
    metadata: {},
    createdBy: "user-1",
    createdByName: "Test User",
    forkedFrom: null,
    organizationId: null,
    visibility: "public",
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
    activated: true,
    email: "test@example.com",
    ...overrides,
  };
}

/** A grantee-picker candidate: outside the owning org and ungranted unless overridden. */
export function createGranteeUser(overrides: Partial<GranteeUserDto> = {}): GranteeUserDto {
  return {
    userId: "user-1",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    avatarUrl: null,
    organizationRole: null,
    existingGrantRole: null,
    ...overrides,
  };
}

// ── Capability signal (detail responses) ────────────────────────

/**
 * A fully enabled capability fixture. Override individual flags or use
 * `readOnlyCapabilities` for a viewer.
 */
export function createCapabilities(
  overrides: Partial<ResourceCapabilities> = {},
): ResourceCapabilities {
  return {
    canContribute: true,
    canUpdate: true,
    canManage: true,
    canShare: true,
    canLeave: true,
    canTransfer: true,
    ...overrides,
  };
}

/** A grantee with read access only — nothing contributable, editable or shareable. */
export const readOnlyCapabilities: ResourceCapabilities = {
  canContribute: false,
  canUpdate: false,
  canManage: false,
  canShare: false,
  canLeave: false,
  canTransfer: false,
};

export function createMacroDetail(overrides: Partial<MacroDetail> = {}): MacroDetail {
  return { ...createMacro(overrides), capabilities: createCapabilities(), ...overrides };
}

export function createProtocolDetail(overrides: Partial<ProtocolDetail> = {}): ProtocolDetail {
  return { ...createProtocol(overrides), capabilities: createCapabilities(), ...overrides };
}

export function createWorkbookDetail(overrides: Partial<WorkbookDetail> = {}): WorkbookDetail {
  return { ...createWorkbook(overrides), capabilities: createCapabilities(), ...overrides };
}

// ── Resource grant (sharing) ────────────────────────────────────

let grantSeq = 0;

/**
 * A direct grant as `GET /{resourceType}/{id}/collaborators` returns it. Defaults
 * to a user grantee who *is* an org member (so `isOutsideCollaborator` is false)
 * with the read-only `viewer` role.
 */
export function createResourceGrant(overrides: Partial<ResourceGrantDto> = {}): ResourceGrantDto {
  grantSeq++;
  return {
    kind: "grant",
    id: `grant-${grantSeq}`,
    resourceType: "experiment",
    resourceId: "resource-1",
    granteeType: "user",
    granteeId: `user-${grantSeq}`,
    role: "viewer",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "owner-1",
    isOutsideCollaborator: false,
    owningOrganization: null,
    grantee: {
      type: "user",
      displayName: "Grace Hopper",
      email: "grace@example.com",
      avatarUrl: null,
      memberCount: null,
    },
    ...overrides,
  };
}

/**
 * An org-derived row as the collaborators endpoint synthesizes it from the resource's
 * owning organization. Carries no grant id and no role — there is nothing to
 * change or revoke on it, beyond an `inertGrant` when one is left over.
 */
export function createResourceOwner(overrides: Partial<ResourceOwnerDto> = {}): ResourceOwnerDto {
  grantSeq++;
  return {
    kind: "owner",
    granteeType: "user",
    organizationName: "Greenhouse Lab",
    granteeId: `owner-${grantSeq}`,
    inertGrant: null,
    grantee: {
      type: "user",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
      memberCount: null,
    },
    ...overrides,
  };
}

// ── Organizations ───────────────────────────────────────────────

let organizationSeq = 0;

/** An organization profile as `GET /organizations/{id}` returns it. */
export function createOrganizationProfile(
  overrides: Partial<OrganizationProfile> = {},
): OrganizationProfile {
  organizationSeq++;
  return {
    id: `org-${organizationSeq}`,
    name: "Greenhouse Lab",
    slug: "greenhouse-lab",
    logo: null,
    type: "research_institute",
    description: null,
    website: null,
    location: null,
    visibility: "private",
    memberCount: 3,
    resourceCount: 7,
    createdAt: "2024-03-04T09:00:00.000Z",
    role: "owner",
    membershipStatus: "member",
    ...overrides,
  };
}

/** A directory row. Defaults to an organization the caller does not belong to. */
export function createOrganizationDirectoryEntry(
  overrides: Partial<OrganizationDirectoryEntry> = {},
): OrganizationDirectoryEntry {
  organizationSeq++;
  return {
    id: `org-${organizationSeq}`,
    name: "Greenhouse Lab",
    slug: "greenhouse-lab",
    logo: null,
    type: "university",
    description: null,
    location: null,
    memberCount: 4,
    resourceCount: 0,
    visibility: "public",
    membershipStatus: "none",
    ...overrides,
  };
}

/** A my-organizations row. Personal workspaces are flagged, not excluded. */
export function createMyOrganization(overrides: Partial<MyOrganization> = {}): MyOrganization {
  organizationSeq++;
  return {
    id: `org-${organizationSeq}`,
    name: "Greenhouse Lab",
    slug: "greenhouse-lab",
    description: null,
    visibility: "private",
    role: "member",
    isPersonal: false,
    memberCount: 4,
    resourceCount: 0,
    ...overrides,
  };
}

/** A roster row. `role` is stored verbatim by Better Auth, hence the plain string. */
export function createOrganizationMember(
  overrides: Partial<OrganizationMember> = {},
): OrganizationMember {
  organizationSeq++;
  return {
    userId: `user-${organizationSeq}`,
    firstName: "Grace",
    lastName: "Hopper",
    email: `grace-${organizationSeq}@example.com`,
    avatarUrl: null,
    role: "member",
    joinedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createOrganizationTeam(
  overrides: Partial<OrganizationTeam> = {},
): OrganizationTeam {
  organizationSeq++;
  return {
    id: `team-${organizationSeq}`,
    name: "Imaging",
    organizationId: "org-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    members: [],
    ...overrides,
  };
}

/**
 * A showcase row. Defaults to an experiment, since that is the only type carrying
 * meta a caller is likely to want to override; pass `type` for the others.
 *
 * Per-type meta is picked by type, not merged: a `device` with no `deviceType` reaches
 * `getSensorFamilyLabel(undefined)`, which throws rather than degrading.
 */
export function createOrganizationResource(
  overrides: Partial<OrganizationResource> = {},
): OrganizationResource {
  organizationSeq++;
  const type = overrides.type ?? "experiment";
  const meta =
    type === "experiment"
      ? { status: "active" }
      : type === "protocol"
        ? { family: "multispeq" }
        : type === "macro"
          ? { language: "python" }
          : type === "device"
            ? { deviceType: "multispeq" }
            : {};

  return {
    type,
    id: `resource-${organizationSeq}`,
    name: `Canopy series ${organizationSeq}`,
    description: null,
    visibility: "public",
    updatedAt: "2026-01-01T00:00:00.000Z",
    collaboratorCount: 1,
    ...meta,
    ...overrides,
  } as OrganizationResource;
}

/** A grant naming one of the organization's teams. */
export function createOrganizationTeamGrant(
  overrides: Partial<OrganizationTeamGrant> = {},
): OrganizationTeamGrant {
  organizationSeq++;
  return {
    id: `grant-${organizationSeq}`,
    teamId: "team-1",
    resourceType: "experiment",
    resourceId: `resource-${organizationSeq}`,
    resourceName: `Canopy series ${organizationSeq}`,
    role: "viewer",
    ...overrides,
  };
}

export function createOrganizationJoinRequest(
  overrides: Partial<OrganizationJoinRequest> = {},
): OrganizationJoinRequest {
  organizationSeq++;
  return {
    id: `request-${organizationSeq}`,
    organizationId: "org-1",
    user: {
      id: `user-${organizationSeq}`,
      firstName: "Alan",
      lastName: "Turing",
      email: `alan-${organizationSeq}@example.com`,
      avatarUrl: null,
    },
    message: null,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Experiment Visualization ────────────────────────────────────

let vizSeq = 0;

// Accept any object in `config` so tests can pass typed `defaultConfig()`
// results into the schema's opaque `Record<string, unknown>` slot.
type VisualizationOverrides = Omit<Partial<ExperimentVisualization>, "config"> & {
  config?: object;
};

export function createVisualization(
  overrides: VisualizationOverrides = {},
): ExperimentVisualization {
  vizSeq++;
  const { config: configOverride, ...rest } = overrides;
  return {
    id: `viz-${vizSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Visualization ${vizSeq}`,
    description: `Description for visualization ${vizSeq}`,
    experimentId: "exp-1",
    chartFamily: "basic",
    chartType: "line",
    config: (configOverride as Record<string, unknown> | undefined) ?? {},
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
    ...rest,
  };
}

// ── Experiment Table Metadata ───────────────────────────────────

let tableSeq = 0;

export function createExperimentTable(
  overrides: Partial<ExperimentTableMetadata> = {},
): ExperimentTableMetadata {
  tableSeq++;
  return {
    identifier: `table_${tableSeq}`,
    tableType: "static",
    displayName: `Table ${tableSeq}`,
    totalRows: 100,
    defaultSortColumn: undefined,
    errorColumn: undefined,
    ...overrides,
  };
}

// ── Place Search Result ─────────────────────────────────────────

let placeSeq = 0;

export function createPlace(
  overrides: Partial<ExperimentPlaceSearchResult> = {},
): ExperimentPlaceSearchResult {
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

// ── ExperimentLocation ────────────────────────────────────────────────────

let locationSeq = 0;

export function createLocation(overrides: Partial<ExperimentLocation> = {}): ExperimentLocation {
  locationSeq++;
  return {
    id: `loc-${locationSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `ExperimentLocation ${locationSeq}`,
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

// ── ExperimentFlow ────────────────────────────────────────────────────────

type FlowNode = ExperimentFlowGraph["nodes"][number];

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
  overrides: Partial<Omit<ExperimentFlow, "graph">> & { graph?: Partial<ExperimentFlowGraph> } = {},
): ExperimentFlow {
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

// ── ExperimentExportRecord ────────────────────────────────────────────────

let exportSeq = 0;

export function createExportRecord(
  overrides: Partial<ExperimentExportRecord> = {},
): ExperimentExportRecord {
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

// ── Invitation ──────────────────────────────────────────────────

let invitationSeq = 0;

export function createInvitation(overrides: Partial<Invitation> = {}): Invitation {
  invitationSeq++;
  return {
    id: `inv-${invitationSeq}-${crypto.randomUUID().slice(0, 8)}`,
    resourceType: "experiment",
    resourceId: crypto.randomUUID(),
    email: `user${invitationSeq}@example.com`,
    // Least privilege by default; "viewer" is the contributing tier.
    tier: "viewer",
    status: "pending",
    invitedBy: "user-1",
    invitedByName: "Test User",
    resourceName: `Experiment ${invitationSeq}`,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let cellSeq = 0;

export function createMarkdownCell(overrides: Partial<MarkdownCell> = {}): MarkdownCell {
  cellSeq++;
  return {
    id: `cell-md-${cellSeq}`,
    type: "markdown",
    content: "",
    isCollapsed: false,
    ...overrides,
  };
}

export function createProtocolCell(overrides: Partial<ProtocolCell> = {}): ProtocolCell {
  cellSeq++;
  return {
    id: `cell-proto-${cellSeq}`,
    type: "protocol",
    payload: { protocolId: crypto.randomUUID(), version: 1 },
    isCollapsed: false,
    ...overrides,
  };
}

export function createCommandCell(
  overrides: Partial<Omit<CommandCell, "payload">> & {
    payload?: Partial<{ format: "string" | "json" | "yaml"; content: string; name: string }>;
  } = {},
): CommandCell {
  cellSeq++;
  const { payload, ...rest } = overrides;
  return {
    id: `cell-cmd-${cellSeq}`,
    type: "command",
    isCollapsed: false,
    ...rest,
    payload: {
      format: payload?.format ?? "string",
      content: payload?.content ?? "battery",
      ...(payload?.name !== undefined ? { name: payload.name } : {}),
    },
  };
}

export function createMacroCell(overrides: Partial<MacroCell> = {}): MacroCell {
  cellSeq++;
  return {
    id: `cell-macro-${cellSeq}`,
    type: "macro",
    payload: { macroId: crypto.randomUUID(), language: "python" },
    isCollapsed: false,
    ...overrides,
  };
}

export function createQuestionCell(overrides: Partial<QuestionCell> = {}): QuestionCell {
  cellSeq++;
  return {
    id: `cell-q-${cellSeq}`,
    type: "question",
    name: `question_${cellSeq}`,
    question: { kind: "open_ended", text: "Enter a value", required: false },
    isCollapsed: false,
    isAnswered: false,
    ...overrides,
  };
}

export function createOutputCell(overrides: Partial<OutputCell> = {}): OutputCell {
  cellSeq++;
  return {
    id: `cell-out-${cellSeq}`,
    type: "output",
    producedBy: `cell-proto-${cellSeq}`,
    isCollapsed: false,
    ...overrides,
  };
}

export function createBranchCell(overrides: Partial<BranchCell> = {}): BranchCell {
  cellSeq++;
  return {
    id: `cell-branch-${cellSeq}`,
    type: "branch",
    paths: [
      {
        id: `path-${cellSeq}-1`,
        label: "Yes",
        color: "#22c55e",
        conditions: [
          {
            id: `cond-${cellSeq}-1`,
            sourceCellId: `cell-q-${cellSeq}`,
            field: "answer",
            operator: "eq",
            value: "yes",
          },
        ],
      },
    ],
    isCollapsed: false,
    ...overrides,
  };
}

// ── Experiment Dashboard ────────────────────────────────────────

let dashboardSeq = 0;
let dashboardWidgetSeq = 0;

function uuid(): string {
  return crypto.randomUUID();
}

export function createRichTextWidget(
  overrides: Partial<ExperimentRichTextWidget> = {},
): ExperimentRichTextWidget {
  dashboardWidgetSeq++;
  return {
    id: uuid(),
    type: "richText",
    layout: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
    config: { html: `<p>Widget ${dashboardWidgetSeq}</p>` },
    ...overrides,
  };
}

export function createVisualizationWidget(
  overrides: Partial<ExperimentVisualizationWidget> = {},
): ExperimentVisualizationWidget {
  dashboardWidgetSeq++;
  const { config: configOverride, ...rest } = overrides;
  return {
    id: uuid(),
    type: "visualization",
    layout: { col: 0, row: 0, colSpan: 6, rowSpan: 4 },
    config: {
      showTitle: true,
      showDescription: false,
      ...configOverride,
    },
    ...rest,
  };
}

export function createTableWidget(
  overrides: Partial<ExperimentTableWidget> = {},
): ExperimentTableWidget {
  dashboardWidgetSeq++;
  const { config: configOverride, ...rest } = overrides;
  return {
    id: uuid(),
    type: "table",
    layout: { col: 0, row: 0, colSpan: 6, rowSpan: 4 },
    config: {
      pageSize: 25,
      showTitle: true,
      showDescription: true,
      ...configOverride,
    },
    ...rest,
  };
}

// Accept Partial<config> so tests don't have to repeat showTitle/showDescription
// when they only care about column/operator/value/tableName.
type FilterWidgetOverrides = Omit<Partial<ExperimentFilterWidget>, "config"> & {
  config?: Partial<ExperimentFilterWidget["config"]>;
};

export function createFilterWidget(overrides: FilterWidgetOverrides = {}): ExperimentFilterWidget {
  dashboardWidgetSeq++;
  const { config: configOverride, ...rest } = overrides;
  return {
    id: uuid(),
    type: "filter",
    layout: { col: 0, row: 0, colSpan: 3, rowSpan: 1 },
    config: {
      showTitle: true,
      showDescription: true,
      ...configOverride,
    },
    ...rest,
  };
}

export function createDashboardLayout(
  overrides: Partial<ExperimentDashboardLayout> = {},
): ExperimentDashboardLayout {
  return {
    columns: 12,
    rowHeight: 80,
    gap: 16,
    ...overrides,
  };
}

export function createExperimentDashboard(
  overrides: Partial<Omit<ExperimentDashboard, "layout" | "widgets">> & {
    layout?: Partial<ExperimentDashboardLayout>;
    widgets?: ExperimentDashboardWidget[];
  } = {},
): ExperimentDashboard {
  dashboardSeq++;
  const { layout: layoutOverrides, widgets, ...rest } = overrides;
  return {
    id: uuid(),
    experimentId: uuid(),
    name: `Dashboard ${dashboardSeq}`,
    description: `Description for dashboard ${dashboardSeq}`,
    layout: createDashboardLayout(layoutOverrides),
    widgets: widgets ?? [],
    createdBy: uuid(),
    createdByName: "Test User",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-15T00:00:00.000Z",
    ...rest,
  };
}

let versionSeq = 0;

export function createWorkbookVersionSummary(
  overrides: Partial<WorkbookVersionSummary> = {},
): WorkbookVersionSummary {
  versionSeq++;
  return {
    id: crypto.randomUUID(),
    workbookId: crypto.randomUUID(),
    version: versionSeq,
    createdAt: "2025-01-01T00:00:00.000Z",
    createdBy: "user-1",
    ...overrides,
  };
}

// ── Upload Metadata ────────────────────────────────────────────

let uploadSeq = 0;

export function createUpload(
  overrides: Partial<ExperimentUploadMetadata> = {},
): ExperimentUploadMetadata {
  uploadSeq++;
  return {
    uploadId: `upload-${uploadSeq}`,
    experimentId: `exp-${uploadSeq}`,
    uploadTableId: `11111111-1111-1111-1111-${uploadSeq.toString().padStart(12, "0")}`,
    uploadTableName: `upload_table_${uploadSeq}`,
    sourceKind: "csv",
    status: "completed",
    fileCount: 1,
    rowCount: 100,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:05:00.000Z",
    errorMessage: null,
    ...overrides,
  };
}

// ── IoT Device ──────────────────────────────────────────────────

let iotDeviceSeq = 0;

export function createIotDevice(
  overrides: Partial<IotDeviceWithConnectivity> = {},
): IotDeviceWithConnectivity {
  iotDeviceSeq++;
  const thingName = `ambyte_${iotDeviceSeq}`;
  return {
    id: crypto.randomUUID(),
    thingName,
    thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${thingName}`,
    serialNumber: `SN-${iotDeviceSeq}`,
    name: `Device ${iotDeviceSeq}`,
    deviceType: "ambyte",
    status: "pending",
    certificateId: null,
    certificateArn: null,
    createdBy: crypto.randomUUID(),
    organizationId: null,
    visibility: "private",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
    // Unknown by default: the fleet index is an enrichment, not a given.
    connectivity: null,
    ...overrides,
  };
}

/**
 * A device as its detail route returns it: the registry row plus the caller's
 * capabilities. Defaults to the owner's view — full control, and no grant of their
 * own to leave, because owning is not a grant.
 */
export function createIotDeviceDetail(overrides: Partial<IotDeviceDetail> = {}): IotDeviceDetail {
  return {
    ...createIotDevice(overrides),
    capabilities: createCapabilities({ canContribute: false, canLeave: false }),
    ...overrides,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

/** Reset sequence counters, useful in beforeEach if deterministic IDs matter */
export function resetFactories() {
  experimentSeq = 0;
  transferSeq = 0;
  macroSeq = 0;
  protocolSeq = 0;
  workbookSeq = 0;
  vizSeq = 0;
  tableSeq = 0;
  placeSeq = 0;
  locationSeq = 0;
  dataTableSeq = 0;
  flowSeq = 0;
  exportSeq = 0;
  invitationSeq = 0;
  cellSeq = 0;
  versionSeq = 0;
  uploadSeq = 0;
  iotDeviceSeq = 0;
  dashboardSeq = 0;
  dashboardWidgetSeq = 0;
  grantSeq = 0;
  organizationSeq = 0;
  deviceGroupSeq = 0;
}

let deviceGroupSeq = 0;

export function createDeviceGroup(
  overrides: Partial<DeviceGroupListItem> = {},
): DeviceGroupListItem {
  deviceGroupSeq++;
  return {
    id: crypto.randomUUID(),
    name: `Group ${String(deviceGroupSeq)}`,
    description: null,
    organizationId: crypto.randomUUID(),
    visibility: "private",
    createdBy: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 0,
    ...overrides,
  };
}

export function createDeviceGroupDetail(
  overrides: Partial<DeviceGroupDetail> = {},
): DeviceGroupDetail {
  return {
    ...createDeviceGroup(),
    capabilities: createCapabilities(),
    ...overrides,
  };
}

export function createDeviceGroupMember(
  overrides: Partial<DeviceGroupMember> = {},
): DeviceGroupMember {
  return {
    deviceId: crypto.randomUUID(),
    name: null,
    serialNumber: "AA:BB:CC:DD",
    deviceType: "ambyte",
    status: "active",
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}
