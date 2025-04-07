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
export const experimentVisibilityEnum = pgEnum("experiment_visibility", [
  "private",
  "public",
]);

export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: experimentStatusEnum("status").default("provisioning").notNull(),
  visibility: experimentVisibilityEnum("visibility")
    .default("private")
    .notNull(),
  embargoIntervalDays: integer("embargo_interval_days").default(90).notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experimentMembersEnum = pgEnum("experiment_members_role", [
  "admin",
  "member",
]);

// Experiment Members (Associative Table)
export const experimentMembers = pgTable("experiment_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id")
    .references(() => experiments.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  role: experimentMembersEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
