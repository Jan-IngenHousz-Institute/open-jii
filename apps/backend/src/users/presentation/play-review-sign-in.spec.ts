import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { openJiiEmailOTP } from "@repo/auth/email-otp";
import { db } from "@repo/database";
import * as schema from "@repo/database/schema";

import { TestHarness } from "../../test/test-harness";

const REVIEW_EMAIL = "play-reviewer@example.com";
const REVIEW_OTP = "482913";

const sendEmail = vi.fn(() => Promise.resolve());

/**
 * `src/test/setup.ts` mocks `@repo/auth/server`, so this builds a real instance on the test
 * database around the same email OTP plugin the server config uses.
 */
const auth = betterAuth({
  secret: "test-secret",
  baseURL: "http://localhost:3020",
  basePath: "/api/v1/auth",
  emailAndPassword: { enabled: false },
  advanced: { database: { generateId: false } },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  plugins: [openJiiEmailOTP({ playReview: { email: REVIEW_EMAIL, otp: REVIEW_OTP }, sendEmail })],
});

async function signInWithReviewCode() {
  await auth.api.sendVerificationOTP({ body: { email: REVIEW_EMAIL, type: "sign-in" } });
  return auth.api.signInEmailOTP({ body: { email: REVIEW_EMAIL, otp: REVIEW_OTP } });
}

describe("Play review sign-in", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("signs the review account in twice in a row with the configured code", async () => {
    const first = await signInWithReviewCode();
    const second = await signInWithReviewCode();

    expect(second.user.id).toBe(first.user.id);
    expect(second.user.email).toBe(REVIEW_EMAIL);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
