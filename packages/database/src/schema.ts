import { primaryKey, unique, index } from "drizzle-orm/pg-core";
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
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  registered: boolean("registered").notNull().default(false),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"email" | "oauth" | "oidc" | "webauthn">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      compositePk: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ],
);

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ],
);

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

// Flow Step Type Enum
export const stepTypeEnum = pgEnum("step_type", [
  "INSTRUCTION",
  "QUESTION",
  "MEASUREMENT",
  "ANALYSIS",
]);

// Answer Type Enum
export const answerTypeEnum = pgEnum("answer_type", ["TEXT", "SELECT", "NUMBER", "BOOLEAN"]);

// Profiles Table
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Organizations Table
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: organizationTypeEnum("type"),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sensors Table
export const sensors = pgTable("sensors", {
  id: uuid("id").primaryKey().defaultRandom(),
  serialNumber: varchar("serial_number", { length: 100 }).unique().notNull(),
  name: text("name").notNull(),
  family: sensorFamilyEnum("family").notNull(),
  location: text("location"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Experiments Table
// Experiment Status Enum
export const experimentStatusEnum = pgEnum("experiment_status", [
  "provisioning",
  "provisioning_failed",
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
  status: experimentStatusEnum("status").default("provisioning").notNull(),
  visibility: experimentVisibilityEnum("visibility").default("public").notNull(),
  embargoIntervalDays: integer("embargo_interval_days").default(90).notNull(),
  flowId: uuid("flow_id").references(() => flows.id), // Optional reference to flow
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
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
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.experimentId, table.userId] })],
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
    addedAt: timestamp("added_at").defaultNow().notNull(),
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
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  details: jsonb("details"),
});

// Protocols Table
export const protocols = pgTable("protocols", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  code: jsonb("code").notNull(),
  family: sensorFamilyEnum("family").notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Flows Table
export const flows = pgTable("flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Flow Steps Table (React Flow Nodes)
export const flowSteps = pgTable(
  "flow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .notNull(),
    type: stepTypeEnum("type").notNull(),

    title: varchar("title", { length: 255 }),
    description: text("description"),
    media: jsonb("media"), // Array of URLs

    // React Flow Node Properties
    position: jsonb("position"), // {x: number, y: number} - nullable during migration
    size: jsonb("size"), // {width?: number, height?: number} - optional

    // Node Behavior
    isStartNode: boolean("is_start_node").default(false).notNull(),
    isEndNode: boolean("is_end_node").default(false).notNull(),

    // Step specification (stored as JSONB for flexibility)
    stepSpecification: jsonb("step_specification"), // Contains step-specific configuration based on type

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Indexes for React Flow compatibility
    index("flow_steps_flow_id_idx").on(table.flowId),
    index("flow_steps_start_node_idx").on(table.flowId, table.isStartNode),
  ],
);

// Flow Step Connections Table (React Flow Edges)
export const flowStepConnections = pgTable(
  "flow_step_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .references(() => flows.id, { onDelete: "cascade" })
      .notNull(),

    // Connection endpoints
    sourceStepId: uuid("source_step_id")
      .references(() => flowSteps.id, { onDelete: "cascade" })
      .notNull(),
    targetStepId: uuid("target_step_id")
      .references(() => flowSteps.id, { onDelete: "cascade" })
      .notNull(),

    // React Flow Edge Properties
    type: varchar("type", { length: 50 }).default("default").notNull(), // 'default', 'smoothstep', 'straight'
    animated: boolean("animated").default(false).notNull(),
    label: varchar("label", { length: 255 }), // Optional label on the edge

    // Conditional Logic
    condition: jsonb("condition"), // Optional condition for this connection path
    priority: integer("priority").default(0).notNull(), // For multiple outgoing connections

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Prevent self-loops and ensure unique connections
    unique("unique_connection").on(table.sourceStepId, table.targetStepId),

    // Indexes for efficient queries
    index("flow_step_connections_flow_id_idx").on(table.flowId),
    index("flow_step_connections_source_idx").on(table.sourceStepId),
    index("flow_step_connections_target_idx").on(table.targetStepId),
  ],
);
