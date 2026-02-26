import { sql } from "drizzle-orm";
import { primaryKey, check } from "drizzle-orm/pg-core";
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
export const sensorFamilyEnum = pgEnum("sensor_family", ["multispeq", "ambit"]);

// Profiles Table
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  activated: boolean("activated").default(true).notNull(),
  deletedAt: timestamp("deleted_at"),
  userId: uuid("user_id")
    .references(() => users.id)
    .unique()
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  ...timestamps,
});

// Organizations Table
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: organizationTypeEnum("type"),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  location: text("location"),
  ...timestamps,
});

// Sensors Table
export const sensors = pgTable("sensors", {
  id: uuid("id").primaryKey().defaultRandom(),
  serialNumber: varchar("serial_number", { length: 100 }).unique().notNull(),
  name: text("name").notNull(),
  family: sensorFamilyEnum("family").notNull(),
  location: text("location"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

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
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  // Databricks pipeline and schema information
  pipelineId: varchar("pipeline_id", { length: 255 }),
  schemaName: varchar("schema_name", { length: 255 }),
  ...timestamps,
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

// Associative table: Experiment Protocols
export const experimentProtocols = pgTable(
  "experiment_protocols",
  {
    experimentId: uuid("experiment_id")
      .references(() => experiments.id, { onDelete: "cascade" })
      .notNull(),
    protocolId: uuid("protocol_id")
      .references(() => protocols.id)
      .notNull(),
    order: integer("order").default(0).notNull(),
    addedAt: timestamp("added_at")
      .default(sql`(now() AT TIME ZONE 'UTC')`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.experimentId, table.protocolId] }),
    // Add index on experimentId for faster lookups
    { index: { columns: [table.experimentId] } },
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
  ...timestamps,
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
  ...timestamps,
});

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
  "error-bar",
  "density-plot",
  "ridge-plot",
  "histogram-2d",
  "scatter2density",
  "spc-control-chart",
  // Scientific charts
  "heatmap",
  "contour",
  "carpet",
  "ternary",
  "parallel-coordinates",
  "log-plot",
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
