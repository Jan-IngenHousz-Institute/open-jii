import postgres from "postgres";

import {
  assertSafeFixtureDatabase,
  databaseUrl,
  deleteFixtureOrganization,
  newcomerEmail,
  removePlatformAdminRole,
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
  assertSafeFixtureDatabase();
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    return await sql.begin(async (tx) => {
      const users = await tx<{ id: string }[]>`select id from users where email = ${seedEmail}`;
      const user = users.at(0);
      if (!user) throw new Error("Seed user missing");
      const organizations = await tx<{ id: string }[]>`
        insert into organizations (name, slug, type, visibility)
        values (${name}, ${name.toLowerCase().replaceAll(" ", "-")}, ${demo ? "demo" : "research_institute"}, ${demo ? "public" : "private"})
        on conflict (slug) do update set name = excluded.name returning id
      `;
      const org = organizations.at(0);
      if (!org) throw new Error("Capture organization missing");
      await tx`insert into organization_members (organization_id, user_id, role)
        values (${org.id}, ${user.id}, 'owner') on conflict do nothing`;
      await tx`insert into experiments (name, created_by, organization_id, visibility)
        values (${demo ? "Demo photosynthesis experiment" : "Unpublished trial"}, ${user.id}, ${org.id}, ${demo ? "public" : "private"})
        on conflict (name) do nothing`;
      return org.id;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export const clearDemoTrainingRecording = (): Promise<void> =>
  deleteFixtureOrganization("demo-training-lab", "Demo training lab");

export const clearDemoRecordingAppointment = (): Promise<void> =>
  removePlatformAdminRole(newcomerEmail);
