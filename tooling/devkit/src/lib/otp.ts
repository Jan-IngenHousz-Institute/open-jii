import postgres from "postgres";

export async function readLatestSignInOtp(databaseUrl: string, email: string): Promise<string> {
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
