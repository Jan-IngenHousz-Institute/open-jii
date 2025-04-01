import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";

// Organization Types Enum
export const organizationTypeEnum = pgEnum("organization_type", [
  "research_institute",
  "non_profit",
  "private_company",
  "government_agency",
  "university",
]);

// Profiles Table
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  userId: uuid("user_id").references(() => users.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Organizations Table
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: organizationTypeEnum("type").notNull(),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users Table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sensors Table
export const sensors = pgTable("sensors", {
  id: uuid("id").primaryKey().defaultRandom(),
  serialNumber: varchar("serial_number", { length: 100 }).unique(),
  name: text("name"),
  location: text("location"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Experiments Table
export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
export const experimentMembersEnum = pgEnum("experiment_members_role", [
  "admin",
  "member",
]);
// Experiment Members (Associative Table)
export const experimentMembers = pgTable("experiment_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id").references(() => experiments.id),
  userId: uuid("user_id").references(() => users.id),
  role: experimentMembersEnum("role").default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Audit Log Table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action"),
  timestamp: timestamp("timestamp").defaultNow(),
  details: jsonb("details"),
});
