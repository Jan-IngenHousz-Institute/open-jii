import postgres from "postgres";

import { assertSafeFixtureDatabase, databaseUrl, seedEmail } from "./helpers.js";

const tag = "workbook-search";
const experimentName = "[E2E] Photosynthesis Workbook Search";
export const workbookSearchNames = {
  chlorophyll: "Chlorophyll Fluorescence Baseline",
  leafArea: "Leaf Area Index Survey",
  drought: "Drought Trial 2",
  zephyr: "Zephyr Notebook",
  quokka: "Quokka Notebook",
} as const;

export interface WorkbookSearchFixtures {
  creatorName: string;
  experimentId: string;
  experimentTerm: string;
}

function connect() {
  return postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
}

export async function cleanupWorkbookSearchFixtures(): Promise<void> {
  assertSafeFixtureDatabase();
  const sql = connect();
  try {
    await sql.begin(async (transaction) => {
      const experiments = await transaction<{ id: string }[]>`
        select id from experiments where name = ${experimentName}
      `;
      const experimentIds = experiments.map(({ id }) => id);
      if (experimentIds.length > 0) {
        await transaction`
          delete from resource_grants
          where resource_type = 'experiment'
            and resource_id in ${transaction(experimentIds)}
        `;
        await transaction`delete from experiments where id in ${transaction(experimentIds)}`;
      }
      await transaction`delete from workbooks where metadata->>'e2e' = ${tag}`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function seedWorkbookSearchFixtures(): Promise<WorkbookSearchFixtures> {
  await cleanupWorkbookSearchFixtures();
  const sql = connect();
  try {
    return await sql.begin(async (transaction) => {
      const seedRows = await transaction<{ id: string; organization_id: string }[]>`
        select u.id, m.organization_id
        from users u
        join organization_members m on m.user_id = u.id
        where u.email = ${seedEmail}
        order by m.created_at
        limit 1
      `;
      const seed = seedRows.at(0);
      if (!seed) throw new Error(`No user and organization found for ${seedEmail}`);

      const otherRows = await transaction<{ id: string; name: string; organization_id: string }[]>`
        select u.id, p.first_name || ' ' || p.last_name as name, m.organization_id
        from users u
        join profiles p on p.user_id = u.id
        join organization_members m on m.user_id = u.id
        where u.email <> ${seedEmail}
          and p.activated = true
          and p.deleted_at is null
        order by u.email, m.created_at
        limit 1
      `;
      const other = otherRows.at(0);
      if (!other) throw new Error("No second active workbook creator found");

      const workbookRows = [
        [workbookSearchNames.chlorophyll, "Baseline run", seed.id, seed.organization_id],
        [workbookSearchNames.leafArea, "Canopy survey", seed.id, seed.organization_id],
        [workbookSearchNames.drought, "Second trial", seed.id, seed.organization_id],
        [workbookSearchNames.zephyr, "Unrelated name", other.id, other.organization_id],
        [workbookSearchNames.quokka, "To be linked", seed.id, seed.organization_id],
      ];
      for (const [name, description, createdBy, organizationId] of workbookRows) {
        await transaction`
          insert into workbooks (
            name, description, cells, metadata, created_by, organization_id, visibility
          ) values (
            ${name}, ${description}, '[]'::jsonb, ${transaction.json({ e2e: tag })},
            ${createdBy}, ${organizationId}, 'public'
          )
        `;
      }

      const experiments = await transaction<{ id: string }[]>`
        insert into experiments (
          name, description, status, visibility, created_by, organization_id
        ) values (
          ${experimentName}, 'Fixture for workbook search E2E coverage', 'active', 'public',
          ${seed.id}, ${seed.organization_id}
        )
        returning id
      `;
      const experimentId = experiments.at(0)?.id;
      if (!experimentId) throw new Error("Failed to create workbook-search experiment");
      await transaction`
        insert into resource_grants (
          resource_type, resource_id, grantee_type, grantee_id, role, created_by
        ) values (
          'experiment', ${experimentId}, 'user', ${seed.id}, 'admin', ${seed.id}
        )
      `;

      return {
        creatorName: other.name,
        experimentId,
        experimentTerm: "photosynthesis",
      };
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}
