import type { Page } from "@playwright/test";
import postgres from "postgres";

import { readLatestSignInOtp } from "@repo/devkit/otp";

export const locale = process.env.E2E_LOCALE ?? "en-US";
export const seedEmail = process.env.E2E_EMAIL ?? "seed@openjii.local";
export const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/openjii_local";

export async function dismissCookieBanner(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Reject all" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

export async function waitForFreshOtp(
  url: string,
  email: string,
  previousOtp: string | null,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const otp = await readLatestSignInOtp(url, email).catch(() => null);
    if (otp && otp !== previousOtp) return otp;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No fresh sign-in OTP found for ${email} within ${timeoutMs}ms`);
}

export async function findSeedExperimentId(): Promise<string> {
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const rows = await sql<{ id: string }[]>`
      select e.id
      from experiments e
      join experiment_members m on m.experiment_id = e.id
      join users u on u.id = m.user_id
      where u.email = ${seedEmail}
        and e.status = 'active'
        and e.name like '[Seed]%'
      order by e.created_at
      limit 1
    `;
    const id = rows.at(0)?.id;
    if (!id) throw new Error(`No active [Seed] experiment found for ${seedEmail}`);
    return id;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
