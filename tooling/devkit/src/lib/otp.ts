import postgres from "postgres";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// Reading sign-in codes is a local-database trick. Against any reachable remote database it would
// log in as anyone, so the same override the e2e fixtures use is the only way past this.
export function assertLocalDatabase(
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.E2E_ALLOW_UNSAFE_DATABASE === "1") return;
  const host = new URL(databaseUrl).hostname;
  if (loopbackHosts.has(host)) return;
  throw new Error(
    `Refusing to read sign-in codes from ${host}; only a local database is allowed. Set E2E_ALLOW_UNSAFE_DATABASE=1 to override.`,
  );
}

export async function readLatestSignInOtp(databaseUrl: string, email: string): Promise<string> {
  assertLocalDatabase(databaseUrl);
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const rows = await sql<{ value: string }[]>`
      select value
      from verifications
      where identifier = ${`sign-in-otp-${email}`}
      order by created_at desc
      limit 1
    `;
    const value = rows.at(0)?.value;
    if (!value) throw new Error(`No sign-in OTP found for ${email}`);
    const otp = value.split(":", 1)[0];
    if (!/^\d{6}$/.test(otp)) throw new Error(`Invalid sign-in OTP stored for ${email}`);
    return otp;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
