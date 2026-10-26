import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, jwt } from "better-auth/plugins";
import { randomBytes, createHash } from "node:crypto";

import { resolveManagedClient } from "@repo/auth/oidc-client-manifest";
import { reconcileManagedClient, hashOAuthClientSecret } from "@repo/auth/oidc-client-reconcile";
import type { ClientSecretStore } from "@repo/auth/oidc-client-reconcile";
import { createSecondaryDatabase, db, eq, sql } from "@repo/database";
import * as schema from "@repo/database/schema";

const manifest = resolveManagedClient(
  "111111111111",
  "arn:aws:iam::222222222222:role/jii-instrument-tracking-prod-oidc-provisioner",
);

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Missing test fixture value");
  return value;
}

class MemorySecretStore implements ClientSecretStore {
  versions: Record<string, string[]> = {};
  values = new Map<string, { client_id: string; client_secret: string }>();
  fail:
    | "put-before"
    | "put-after"
    | "promote-before"
    | "promote-after"
    | "cleanup-before"
    | undefined;
  describe() {
    return Promise.resolve({
      arn: `${manifest.secretArnPrefix}fixture`,
      versions: structuredClone(this.versions),
    });
  }
  putPending(version: string, credentials: { client_id: string; client_secret: string }) {
    if (this.fail === "put-before") return Promise.reject(new Error("destination unavailable"));
    for (const stages of Object.values(this.versions)) {
      const index = stages.indexOf("AWSPENDING");
      if (index !== -1) stages.splice(index, 1);
    }
    this.versions[version] = ["AWSPENDING"];
    this.values.set(version, credentials);
    return this.fail === "put-after"
      ? Promise.reject(new Error("lost pending response"))
      : Promise.resolve();
  }
  promote(version: string, previous?: string) {
    if (this.fail === "promote-before") return Promise.reject(new Error("promotion unavailable"));
    if (previous && previous !== version) this.versions[previous] = ["AWSPREVIOUS"];
    this.versions[version] = ["AWSCURRENT", "AWSPENDING"];
    if (this.fail === "cleanup-before") return Promise.reject(new Error("cleanup unavailable"));
    this.versions[version] = ["AWSCURRENT"];
    return this.fail === "promote-after"
      ? Promise.reject(new Error("lost promotion response"))
      : Promise.resolve();
  }
}

const auth = betterAuth({
  secret: "provisioning-integration-test-secret-at-least-32",
  baseURL: "http://localhost:3020",
  basePath: "/api/v1/auth",
  advanced: { database: { generateId: false } },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      jwks: schema.jwks,
      oauthClient: schema.oauthClients,
      oauthAccessToken: schema.oauthAccessTokens,
      oauthRefreshToken: schema.oauthRefreshTokens,
      oauthConsent: schema.oauthConsents,
    },
  }),
  plugins: [
    jwt({ disableSettingJwtHeader: true }),
    emailOTP({ sendVerificationOTP: () => Promise.resolve() }),
    oauthProvider({
      loginPage: "http://localhost:3000/en-US/login",
      consentPage: "http://localhost:3000/en-US/consent",
      scopes: [...manifest.scopes],
      grantTypes: [...manifest.grantTypes],
      clientPrivileges: () => false,
      silenceWarnings: { oauthAuthServerConfig: true },
    }),
  ],
});

const operation = { id: "github-123", rotate: false };
let secrets: MemorySecretStore;
let connection: ReturnType<typeof createSecondaryDatabase>;

beforeEach(async () => {
  secrets = new MemorySecretStore();
  connection = createSecondaryDatabase();
  await db.delete(schema.oauthClients);
});
afterEach(async () => {
  await connection.close();
  await db.execute(sql`drop trigger if exists reject_oidc_fixture on oauth_clients`);
  await db.execute(sql`drop function if exists reject_oidc_fixture()`);
  await db.delete(schema.oauthClients);
  await db.delete(schema.users).where(eq(schema.users.email, "provisioning-fixture@example.org"));
});

function reconcile(input = operation) {
  return reconcileManagedClient(connection.database, secrets, manifest, input);
}

describe("managed OAuth client provisioning", () => {
  it("stores only the canonical hash, owns no user session, and is stable on repeated runs", async () => {
    const first = await reconcile();
    const [client] = await db
      .select()
      .from(schema.oauthClients)
      .where(eq(schema.oauthClients.clientId, manifest.clientId));
    const credentials = secrets.values.get(first.versionId);
    expect(credentials).toBeDefined();
    expect(client.userId).toBeNull();
    expect(client.clientSecret).toBe(hashOAuthClientSecret(required(credentials).client_secret));
    expect(JSON.stringify(client)).not.toContain(required(credentials).client_secret);
    expect(await reconcile()).toMatchObject({ action: "unchanged", versionId: first.versionId });
    expect(secrets.values.size).toBe(1);
  });

  it.each(["put-before", "put-after"] as const)(
    "recovers a pending-write failure at %s without publishing unmatched credentials",
    async (boundary) => {
      secrets.fail = boundary;
      await expect(reconcile()).rejects.toThrow();
      expect(await db.select().from(schema.oauthClients)).toHaveLength(0);
      expect(Object.values(secrets.versions).some((stages) => stages.includes("AWSCURRENT"))).toBe(
        false,
      );
      secrets.fail = undefined;
      expect(await reconcile()).toMatchObject({ action: "created" });
    },
  );

  it("leaves pending credentials unpublished when the database write fails, then retries", async () => {
    await db.execute(
      sql`create function reject_oidc_fixture() returns trigger language plpgsql as $$ begin raise exception 'fixture DB write failure'; end $$`,
    );
    await db.execute(
      sql`create trigger reject_oidc_fixture before insert on oauth_clients for each row execute function reject_oidc_fixture()`,
    );
    await expect(reconcile()).rejects.toThrow();
    expect(Object.values(secrets.versions).flat()).not.toContain("AWSCURRENT");
    await db.execute(sql`drop trigger reject_oidc_fixture on oauth_clients`);
    expect(await reconcile()).toMatchObject({ action: "created" });
  });

  it.each(["promote-before", "promote-after"] as const)(
    "resumes a promotion failure at %s without rotating again",
    async (boundary) => {
      secrets.fail = boundary;
      await expect(reconcile()).rejects.toThrow();
      const [client] = await db.select().from(schema.oauthClients);
      expect(client).toBeDefined();
      secrets.fail = undefined;
      expect(await reconcile()).toMatchObject({
        action: boundary === "promote-before" ? "resumed" : "unchanged",
      });
      expect(secrets.values.size).toBe(1);
    },
  );

  it("resumes removal of the pending label after the current version moved", async () => {
    secrets.fail = "cleanup-before";
    await expect(reconcile()).rejects.toThrow();
    secrets.fail = undefined;
    expect((await reconcile()).action).toBe("resumed");
    expect(secrets.values.size).toBe(1);
    expect(Object.values(secrets.versions)).toEqual([["AWSCURRENT"]]);
  });

  it("rotates only when explicitly requested and treats the same deployment retry as unchanged", async () => {
    const first = await reconcile();
    expect((await reconcile({ id: "other-run", rotate: false })).versionId).toBe(first.versionId);
    const rotated = await reconcile({ id: "rotation-run", rotate: true });
    expect(rotated.action).toBe("rotated");
    expect(rotated.versionId).not.toBe(first.versionId);
    expect((await reconcile({ id: "rotation-run", rotate: true })).action).toBe("unchanged");
    expect(secrets.values.size).toBe(2);
  });

  it("refuses conflicting ownership, ambiguous clients and unmanaged current credentials", async () => {
    await db
      .insert(schema.oauthClients)
      .values({ clientId: manifest.clientId, redirectUris: [...manifest.redirectUris] });
    await expect(reconcile()).rejects.toThrow("Unmanaged OAuth client");
    await db.insert(schema.oauthClients).values({
      clientId: "other",
      referenceId: manifest.referenceId,
      redirectUris: [...manifest.redirectUris],
    });
    await expect(reconcile()).rejects.toThrow("Ambiguous");
    await db.delete(schema.oauthClients);
    secrets.versions.unmanaged = ["AWSCURRENT"];
    await expect(reconcile()).rejects.toThrow("unmanaged current secret");
  });

  it("serializes two actual PostgreSQL connections with the same advisory lock", async () => {
    const other = createSecondaryDatabase();
    try {
      const results = await Promise.all([
        reconcile(),
        reconcileManagedClient(other.database, secrets, manifest, operation),
      ]);
      expect(results.map((result) => result.action).sort()).toEqual(["created", "unchanged"]);
      expect(secrets.values.size).toBe(1);
    } finally {
      await other.close();
    }
  });

  it("completes real plugin token exchange using the Postgres-provisioned confidential client", async () => {
    const result = await reconcile();
    const credentials = required(secrets.values.get(result.versionId));
    const email = "provisioning-fixture@example.org";
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    const [verification] = await db
      .select()
      .from(schema.verifications)
      .where(eq(schema.verifications.identifier, `sign-in-otp-${email}`));
    const signedIn = await auth.api.signInEmailOTP({
      body: { email, otp: verification.value.split(":")[0] },
      asResponse: true,
    });
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const verifier = randomBytes(32).toString("base64url");
    const issuer = "http://localhost:3020/api/v1/auth";
    const query = new URLSearchParams({
      client_id: manifest.clientId,
      redirect_uri: manifest.redirectUris[0],
      response_type: "code",
      scope: "openid profile email",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      state: "fixture",
      nonce: "fixture-nonce",
    });
    const authorization = await auth.handler(
      new Request(`${issuer}/oauth2/authorize?${query}`, { headers: { cookie } }),
    );
    expect(authorization.status).toBe(302);
    const callback = new URL(required(authorization.headers.get("location")));
    const response = await auth.handler(
      new Request(`${issuer}/oauth2/token`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          redirect_uri: manifest.redirectUris[0],
          code: required(callback.searchParams.get("code")),
          code_verifier: verifier,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const tokens = (await response.json()) as { id_token: string; access_token: string };
    expect(tokens.id_token).toBeTypeOf("string");
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
    ) as { aud: string; nonce: string };
    expect(payload.aud).toBe(manifest.clientId);
    expect(payload.nonce).toBe("fixture-nonce");
    const denied = await auth.handler(
      new Request(`${issuer}/oauth2/create-client`, {
        method: "POST",
        headers: { cookie, origin: "http://localhost:3020", "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "untrusted",
          redirect_uris: [...manifest.redirectUris],
        }),
      }),
    );
    expect(denied.status).toBe(401);
  });
});
