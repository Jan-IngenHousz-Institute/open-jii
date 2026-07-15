import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { primaryKey, check, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  uuid,
  integer,
  bigint,
  decimal,
  customType,
} from "drizzle-orm/pg-core";

// UTC timestamps helper
const timestamps = {
  createdAt: timestamp("created_at")
    .default(sql`(now() AT TIME ZONE 'UTC')`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`(now() AT TIME ZONE 'UTC')`)
    .$onUpdate(() => new Date())
    .notNull(),
};

// Postgres tsvector column for full-text search. The actual GENERATED ALWAYS expression and the
// GIN / pg_trgm indexes are defined in the migration SQL (see drizzle/00xx_*_search*.sql) — they
// reference helper functions and operator classes that drizzle-kit cannot serialise reliably.
// This column is excluded from API responses (stripped in repositories + omitted from DTO schemas).
// The 'english' config below must match FTS_CONFIG in apps/backend/src/common/utils/fts.ts, which
// builds the matching tsquery at search time.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  registered: boolean("registered").notNull().default(false),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Better Auth organization plugin: the user's currently active organization.
  activeOrganizationId: uuid("active_organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  // Better Auth organization plugin (teams): the session's active team.
  activeTeamId: uuid("active_team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  ...timestamps,
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestamps,
});

// Rate Limit Table - for Better Auth rate limiting
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Organization Types Enum
export const organizationTypeEnum = pgEnum("organization_type", [
  "research_institute",
  "non_profit",
  "private_company",
  "government_agency",
  "university",
]);

// Sensor Family Enum
export const sensorFamilyEnum = pgEnum("sensor_family", [
  "multispeq",
  "ambyte",
  "minipar",
  "generic",
]);

// Profiles Table
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  activated: boolean("activated").default(true).notNull(),
  deletedAt: timestamp("deleted_at"),
  whatsNewLastSeenAt: timestamp("whats_new_last_seen_at"),
  userId: uuid("user_id")
    .references(() => users.id)
    .unique()
    .notNull(),
  ...timestamps,
});

// Resource visibility (macros/protocols/workbooks; experiments have their own
// experiment_visibility enum with identical values). Affects read access only.
export const visibilityEnum = pgEnum("visibility", ["private", "public"]);

// Org-wide base permission for plain members. none = explicit grant required;
// read = read every org resource; admin = manage every org resource. Owners/admins
// always have full access; explicit resource grants override this baseline.
export const orgBasePermissionEnum = pgEnum("org_base_permission", ["none", "read", "admin"]);

// Organizations Table.
// Backs the Better Auth organization plugin (model "organization"): the plugin
// owns slug/logo/metadata; type/description/website/location are openJII
// additionalFields kept from the original organizations table.
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  type: organizationTypeEnum("type"),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  location: text("location"),
  // Baseline access a plain member gets to this org's resources (default read).
  basePermission: orgBasePermissionEnum("base_permission").default("read").notNull(),
  ...timestamps,
});

// Organization Members (Better Auth organization plugin, model "member").
// Per-org role string (owner/admin/member + future custom roles). Distinct from
// experimentMembers, which becomes the per-resource grant layer in a later phase.
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at")
      .default(sql`(now() AT TIME ZONE 'UTC')`)
      .notNull(),
  },
  (t) => [
    uniqueIndex("organization_members_org_user_uniq").on(t.organizationId, t.userId),
    index("organization_members_user_idx").on(t.userId),
  ],
);

// Organization Invitations (Better Auth organization plugin, model "invitation").
// Separate from the legacy `invitations` table (platform/experiment), which is kept
// during the transition and deprecated later.
export const organizationInvitations = pgTable("organization_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  inviterId: uuid("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Better Auth teams: optional team the invite is for.
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at")
    .default(sql`(now() AT TIME ZONE 'UTC')`)
    .notNull(),
});

// Teams (Better Auth organization plugin, model "team"): a sub-group within an org.
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("teams_organization_idx").on(t.organizationId)],
);

// Team Members (Better Auth organization plugin, model "teamMember").
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .default(sql`(now() AT TIME ZONE 'UTC')`)
      .notNull(),
  },
  (t) => [
    uniqueIndex("team_members_team_user_uniq").on(t.teamId, t.userId),
    index("team_members_user_idx").on(t.userId),
  ],
);

// Experiments Table
// Experiment Status Enum
// Provisioning statuses removed - with centrum consolidation, all experiments use single schema
export const experimentStatusEnum = pgEnum("experiment_status", [
  "active",
  "stale",
  "archived",
  "published",
]);

// Experiment Visibility Enum
export const experimentVisibilityEnum = pgEnum("experiment_visibility", ["private", "public"]);

export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: experimentStatusEnum("status").default("active").notNull(),
  visibility: experimentVisibilityEnum("visibility").default("public").notNull(),
  embargoUntil: timestamp("embargo_until")
    .default(sql`((now() AT TIME ZONE 'UTC') + interval '90 days')`)
    .notNull(),
  anonymizeContributors: boolean("anonymize_contributors").default(false).notNull(),
  workbookId: uuid("workbook_id").references(() => workbooks.id, { onDelete: "set null" }),
  workbookVersionId: uuid("workbook_version_id").references(() => workbookVersions.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  // Owning organization (nullable during transition; backfilled to the creator's
  // personal org). Experiments already carry visibility above.
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  ...timestamps,
  // Weighted full-text search vector: name (A) + description (B). See migration for the
  // GENERATED ALWAYS expression and the GIN index. Excluded from API responses.
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    (): SQL =>
      sql`setweight(to_tsvector('english', coalesce(${experiments.name}, '')), 'A') || setweight(to_tsvector('english', coalesce(${experiments.description}, '')), 'B')`,
  ),
});

export const experimentMembersEnum = pgEnum("experiment_members_role", ["admin", "member"]);
// Experiment Members (Associative Table)
export const experimentMembers = pgTable(
  "experiment_members",
  {
    experimentId: uuid("experiment_id")
      .references(() => experiments.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: experimentMembersEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at")
      .default(sql`(now() AT TIME ZONE 'UTC')`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.experimentId, table.userId] })],
);

// Invitation Status Enum
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "revoked"]);

// Invitation Resource Type Enum
export const invitationResourceTypeEnum = pgEnum("invitation_resource_type", [
  "platform",
  "experiment",
]);

// Invitations Table
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceType: invitationResourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    email: text("email").notNull(),
    role: text("role").default("member").notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    invitedBy: uuid("invited_by")
      .references(() => users.id)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "resource_id_check",
      sql`(${table.resourceType} = 'platform' AND ${table.resourceId} IS NULL) OR (${table.resourceType} != 'platform' AND ${table.resourceId} IS NOT NULL)`,
    ),
  ],
);

// Join Request Status Enum
export const joinRequestStatusEnum = pgEnum("join_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

// Experiment Join Requests Table
export const experimentJoinRequests = pgTable(
  "experiment_join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .references(() => experiments.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    message: varchar("message", { length: 250 }),
    status: joinRequestStatusEnum("status").default("pending").notNull(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at"),
    ...timestamps,
  },
  (table) => [
    // At most one pending request per (experiment, user); resolved rows are not deduped.
    uniqueIndex("experiment_join_requests_pending_uniq")
      .on(table.experimentId, table.userId)
      .where(sql`${table.status} = 'pending'`),
    index("experiment_join_requests_experiment_idx").on(table.experimentId),
  ],
);

// Audit Log Table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  action: text("action").notNull(),
  timestamp: timestamp("timestamp")
    .default(sql`(now() AT TIME ZONE 'UTC')`)
    .notNull(),
  details: jsonb("details"),
});

// Protocols Table
export const protocols = pgTable("protocols", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  code: jsonb("code").notNull(),
  family: sensorFamilyEnum("family").notNull(),
  sortOrder: integer("sort_order"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  // Source protocol this was forked from (a copy made by a non-creator so they
  // can edit it); null for originals.
  forkedFrom: uuid("forked_from").references((): AnyPgColumn => protocols.id, {
    onDelete: "set null",
  }),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  visibility: visibilityEnum("visibility").default("public").notNull(),
  ...timestamps,
  // Weighted full-text search vector: name (A) + description (B). The `family` enum is matched at
  // query time (enum->text casts are not immutable, so they can't live in a generated column).
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    (): SQL =>
      sql`setweight(to_tsvector('english', coalesce(${protocols.name}, '')), 'A') || setweight(to_tsvector('english', coalesce(${protocols.description}, '')), 'B')`,
  ),
});

// Macro Language Enum
export const macroLanguageEnum = pgEnum("macro_language", ["python", "r", "javascript"]);

// Macros Table - only stores metadata, actual code files are handled by Databricks
export const macros = pgTable("macros", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  filename: varchar("filename", { length: 255 }).notNull().unique(),
  description: text("description"),
  language: macroLanguageEnum("language").notNull(),
  code: text("code").notNull(), // Base64 encoded content of the macro code
  sortOrder: integer("sort_order"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  // Source macro this was forked from; null for originals.
  forkedFrom: uuid("forked_from").references((): AnyPgColumn => macros.id, {
    onDelete: "set null",
  }),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  visibility: visibilityEnum("visibility").default("public").notNull(),
  ...timestamps,
  // Weighted full-text search vector: name (A) + description (B). The `language` enum is matched at
  // query time (enum->text casts are not immutable, so they can't live in a generated column).
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    (): SQL =>
      sql`setweight(to_tsvector('english', coalesce(${macros.name}, '')), 'A') || setweight(to_tsvector('english', coalesce(${macros.description}, '')), 'B')`,
  ),
});

// Protocol-Macro Compatibility (many-to-many)
export const protocolMacros = pgTable(
  "protocol_macros",
  {
    protocolId: uuid("protocol_id")
      .references(() => protocols.id, { onDelete: "cascade" })
      .notNull(),
    macroId: uuid("macro_id")
      .references(() => macros.id, { onDelete: "cascade" })
      .notNull(),
    addedAt: timestamp("added_at")
      .default(sql`(now() AT TIME ZONE 'UTC')`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.protocolId, table.macroId] })],
);

// Flows Table - stores a single graph JSON per experiment (1:1)
export const flows = pgTable("flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" })
    .unique(),
  graph: jsonb("graph").notNull(),
  ...timestamps,
});

// Experiment Locations Table - stores locations directly tied to experiments
export const experimentLocations = pgTable("experiment_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id")
    .references(() => experiments.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  country: varchar("country", { length: 100 }),
  region: varchar("region", { length: 100 }),
  municipality: varchar("municipality", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  addressLabel: text("address_label"),
  ...timestamps,
});

// Chart family enum for visualizations
export const chartFamilyEnum = pgEnum("chart_family", ["basic", "scientific", "3d", "statistical"]);

// Chart type enum for basic charts (extendable)
export const chartTypeEnum = pgEnum("chart_type", [
  "line",
  "scatter",
  "bar",
  "pie",
  "area",
  "dot-plot",
  "bubble",
  "lollipop",
  // Statistical charts
  "box-plot",
  "histogram",
  "violin-plot",
  "density-plot",
  "ridge-plot",
  "histogram-2d",
  "density-plot-2d",
  "spc-control-chart",
  // Scientific charts
  "heatmap",
  "contour",
  "carpet",
  "ternary",
  "parallel-coordinates",
  "wind-rose",
  "radar",
  "polar",
  "correlation-matrix",
  "alluvial",
]);

// Experiment Visualizations Table - stores chart configurations for experiments
export const experimentVisualizations = pgTable("experiment_visualizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  experimentId: uuid("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  chartFamily: chartFamilyEnum("chart_family").notNull(),
  chartType: chartTypeEnum("chart_type").notNull(),
  // Configuration stored as JSONB for flexibility
  config: jsonb("config").notNull(),
  // Data source configuration - which tables and columns to use
  dataConfig: jsonb("data_config").notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  ...timestamps,
});

export const workbooks = pgTable(
  "workbooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    cells: jsonb("cells").notNull().default([]),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    // Source workbook this was duplicated from; null for originals.
    forkedFrom: uuid("forked_from").references((): AnyPgColumn => workbooks.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    visibility: visibilityEnum("visibility").default("public").notNull(),
    ...timestamps,
    // Weighted full-text search vector: name (A) + description (B). See migration for the
    // GENERATED ALWAYS expression and the GIN index. Excluded from API responses.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(${workbooks.name}, '')), 'A') || setweight(to_tsvector('english', coalesce(${workbooks.description}, '')), 'B')`,
    ),
  },
  (table) => [index("workbooks_created_by_idx").on(table.createdBy)],
);

// Immutable cell snapshots; published when a workbook is attached to an experiment.
export const workbookVersions = pgTable(
  "workbook_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workbookId: uuid("workbook_id")
      .notNull()
      .references(() => workbooks.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    cells: jsonb("cells").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    entitySnapshots: jsonb("entity_snapshots").notNull().default({ protocols: {}, macros: {} }),
    createdAt: timestamp("created_at")
      .default(sql`(now() AT TIME ZONE 'UTC')`)
      .notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    unique("workbook_versions_workbook_version_uniq").on(table.workbookId, table.version),
    index("workbook_versions_workbook_id_idx").on(table.workbookId),
  ],
);

// Resource grant scope + grantee enums (Phase 2 authorization substrate).
// "device" is reserved now so wiring sensors later needs no ALTER TYPE.
export const resourceTypeEnum = pgEnum("resource_type", [
  "experiment",
  "macro",
  "protocol",
  "workbook",
  "device",
]);
export const granteeTypeEnum = pgEnum("grantee_type", ["user", "organization", "team"]);

// Resource Grants: polymorphic per-resource sharing that generalizes
// experiment_members to every resource type. A resource can be granted to a
// single user, an organization, or a team. FK on the polymorphic ids is enforced
// in the app layer since the referenced table varies by type.
export const resourceGrants = pgTable(
  "resource_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceType: resourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    granteeType: granteeTypeEnum("grantee_type").notNull(),
    granteeId: uuid("grantee_id").notNull(),
    role: text("role").default("member").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("resource_grants_unique").on(
      t.resourceType,
      t.resourceId,
      t.granteeType,
      t.granteeId,
    ),
    index("resource_grants_resource_idx").on(t.resourceType, t.resourceId),
    index("resource_grants_grantee_idx").on(t.granteeType, t.granteeId),
  ],
);

export const experimentDashboards = pgTable(
  "experiment_dashboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    layout: jsonb("layout")
      .notNull()
      .default(sql`'{"columns":12,"rowHeight":80,"gap":16}'::jsonb`),
    widgets: jsonb("widgets")
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    ...timestamps,
  },
  (t) => [index("experiment_dashboards_experiment_id_idx").on(t.experimentId)],
);

export const deviceStatusEnum = pgEnum("device_status", [
  "pending",
  "active",
  "rotating",
  "revoked",
]);

export const iotDevices = pgTable(
  "iot_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thingName: text("thing_name").notNull().unique(),
    thingArn: text("thing_arn").notNull(),
    serialNumber: text("serial_number").notNull().unique(),
    name: varchar("name", { length: 255 }),
    deviceType: sensorFamilyEnum("device_type").notNull(),
    status: deviceStatusEnum("status").default("pending").notNull(),
    certificateId: text("certificate_id"),
    certificateArn: text("certificate_arn"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    ...timestamps,
  },
  (t) => [index("iot_devices_created_by_idx").on(t.createdBy)],
);
