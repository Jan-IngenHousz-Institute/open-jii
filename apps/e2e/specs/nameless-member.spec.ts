import postgres from "postgres";

import { expect, test } from "../fixtures.js";
import {
  assertSafeFixtureDatabase,
  databaseUrl,
  dismissCookieBanner,
  locale,
  seedEmail,
} from "../helpers.js";

const namelessEmail = "nameless-member@e2e.openjii.local";
const organizationSlug = "e2e-nameless-member";

function connect() {
  return postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
}

async function cleanupNamelessMember(): Promise<void> {
  assertSafeFixtureDatabase();
  const sql = connect();
  try {
    await sql.begin(async (transaction) => {
      // Memberships cascade with the organization and with the user.
      await transaction`delete from organizations where slug = ${organizationSlug}`;
      await transaction`
        delete from profiles
        where user_id in (select id from users where email = ${namelessEmail})
      `;
      await transaction`delete from users where email = ${namelessEmail}`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** An organization the seed user owns, with one member whose profile name is empty. */
async function seedNamelessMember(): Promise<string> {
  await cleanupNamelessMember();
  const sql = connect();
  try {
    return await sql.begin(async (transaction) => {
      const seeds = await transaction<{ id: string }[]>`
        select id from users where email = ${seedEmail}
      `;
      const seedId = seeds.at(0)?.id;
      if (!seedId) throw new Error(`No user found for ${seedEmail}`);

      const organizations = await transaction<{ id: string }[]>`
        insert into organizations (name, slug)
        values ('[E2E] Nameless Member Lab', ${organizationSlug})
        returning id
      `;
      const organizationId = organizations.at(0)?.id;
      if (!organizationId) throw new Error("Failed to create the nameless-member organization");
      await transaction`
        insert into organization_members (organization_id, user_id, role)
        values (${organizationId}, ${seedId}, 'owner')
      `;

      const users = await transaction<{ id: string }[]>`
        insert into users (name, email, email_verified, registered)
        values ('', ${namelessEmail}, true, true)
        returning id
      `;
      const userId = users.at(0)?.id;
      if (!userId) throw new Error("Failed to create the nameless member");
      await transaction`
        insert into profiles (user_id, first_name, last_name, activated)
        values (${userId}, '', '', true)
      `;
      await transaction`
        insert into organization_members (organization_id, user_id, role)
        values (${organizationId}, ${userId}, 'member')
      `;
      return organizationId;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

test.afterEach(async () => {
  await cleanupNamelessMember();
});

test("a member without a name reads as an unnamed account, with their email underneath", async ({
  page,
}) => {
  const organizationId = await seedNamelessMember();

  await page.goto(`/${locale}/platform/organizations/${organizationId}/members`);
  await dismissCookieBanner(page);

  const row = page.getByRole("listitem").filter({ hasText: namelessEmail });
  const name = row.getByText("Unnamed account", { exact: true });
  const email = row.getByText(namelessEmail, { exact: true });
  await expect(name).toBeVisible();
  await expect(email).toBeVisible();

  const nameBox = await name.boundingBox();
  const emailBox = await email.boundingBox();
  if (!nameBox || !emailBox) throw new Error("The member row did not lay out");
  expect(emailBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
});
