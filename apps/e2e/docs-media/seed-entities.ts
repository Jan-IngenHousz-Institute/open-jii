import postgres from "postgres";

import { eq } from "@repo/database";
import { users, organizations, organizationMembers, experiments } from "@repo/database/schema";

import {
  withFixtureDatabase,
  databaseUrl,
  deleteFixtureOrganization,
  seedEmail,
} from "../helpers.js";

/**
 * Shots address seeded entities by name so the manifest stays readable and
 * survives a reseed; only the lookup knows about identifiers.
 */
async function lookup(query: (sql: postgres.Sql) => Promise<{ id: string }[]>): Promise<string> {
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const id = (await query(sql)).at(0)?.id;
    if (!id) throw new Error("No seeded row matched");
    return id;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export const organizationId = (name: string): Promise<string> =>
  lookup((sql) => sql<{ id: string }[]>`select id from organizations where name = ${name} limit 1`);

export const experimentId = (name: string): Promise<string> =>
  lookup((sql) => sql<{ id: string }[]>`select id from experiments where name = ${name} limit 1`);

export const workbookId = (name: string): Promise<string> =>
  lookup((sql) => sql<{ id: string }[]>`select id from workbooks where name = ${name} limit 1`);

export const protocolId = (name: string): Promise<string> =>
  lookup((sql) => sql<{ id: string }[]>`select id from protocols where name = ${name} limit 1`);

/**
 * A workbook the seed user owns that carries no published version, so cells can
 * be added and abandoned during a capture without producing a new version.
 */
export const protocolWorkbookId = (): Promise<string> =>
  lookup(
    (sql) => sql<{ id: string }[]>`
      select w.id
      from workbooks w
      join users u on u.id = w.created_by
      left join workbook_versions v on v.workbook_id = w.id
      where u.email = ${seedEmail}
      group by w.id, w.name
      having count(v.id) = 0
      order by w.name
      limit 1
    `,
  );

export async function demoRecordingOrganization(name: string, demo: boolean): Promise<string> {
  return withFixtureDatabase((database) =>
    database.transaction(async (tx) => {
      const user = (
        await tx.select({ id: users.id }).from(users).where(eq(users.email, seedEmail)).limit(1)
      ).at(0);
      if (!user) throw new Error("Seed user missing");
      const org = (
        await tx
          .insert(organizations)
          .values({
            name,
            slug: name.toLowerCase().replaceAll(" ", "-"),
            type: demo ? "demo" : "research_institute",
            visibility: demo ? "public" : "private",
          })
          .onConflictDoUpdate({ target: organizations.slug, set: { name } })
          .returning({ id: organizations.id })
      ).at(0);
      if (!org) throw new Error("Capture organization missing");
      await tx
        .insert(organizationMembers)
        .values({ organizationId: org.id, userId: user.id, role: "owner" })
        .onConflictDoNothing();
      await tx
        .insert(experiments)
        .values({
          name: demo ? "Demo photosynthesis experiment" : "Unpublished trial",
          createdBy: user.id,
          organizationId: org.id,
          visibility: demo ? "public" : "private",
        })
        .onConflictDoNothing({ target: experiments.name });
      return org.id;
    }),
  );
}

export const clearDemoTrainingRecording = (): Promise<void> =>
  deleteFixtureOrganization("demo-training-lab", "Demo training lab");
