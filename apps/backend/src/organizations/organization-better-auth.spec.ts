import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import { openJiiOrganization } from "@repo/auth/organization";
import {
  and,
  db,
  eq,
  ensurePersonalOrganization,
  organizationInvitations,
  organizationMembers,
  organizations,
  resourceGrants,
  teams,
} from "@repo/database";
import * as schema from "@repo/database/schema";

import { TestHarness } from "../test/test-harness";

/**
 * The backend suite mocks `@repo/auth/server` down to `getSession`, so none of the
 * organization plugin's configuration or protection hooks executes anywhere else in
 * it. This file drives them for real: a genuine Better Auth instance, wired to the
 * same test database, carrying the same organization plugin the server config uses.
 *
 * Only the surrounding instance is rebuilt (session handling, email OTP sign-in);
 * everything under test — the permission matrix, the additional fields, the limits
 * and every hook — comes from `openJiiOrganization()` itself. `generateId: false`
 * is mirrored because Better Auth infers invitation-verification behaviour from it.
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
      organization: schema.organizations,
      member: schema.organizationMembers,
      invitation: schema.organizationInvitations,
      team: schema.teams,
      teamMember: schema.teamMembers,
    },
  }),
  plugins: [
    emailOTP({
      // Delivery is irrelevant here; the code is read back from the database.
      sendVerificationOTP: () => Promise.resolve(),
    }),
    openJiiOrganization(),
  ],
});

interface Signed {
  userId: string;
  email: string;
  headers: Headers;
}

/** Sign a brand-new account in over email OTP and keep its session cookie. */
async function signIn(label: string): Promise<Signed> {
  const email = `${label}-${crypto.randomUUID()}@example.com`;
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const { otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } });
  if (!otp) throw new Error("No sign-in OTP was stored");

  const { headers, response } = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });

  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  return { userId: response.user.id, email, headers: new Headers({ cookie }) };
}

const uniqueSlug = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/**
 * Better Auth's own refusals, matched on the message it raises. Matched exactly
 * rather than with a bare `rejects.toThrow()` so a broken fixture — which surfaces
 * as `Member not found` from the endpoint under test — cannot pass as the refusal
 * the test claims to be pinning.
 */
const NOT_ALLOWED_TO_UPDATE_ORGANIZATION = /not allowed to update this organization/i;
const NOT_ALLOWED_TO_UPDATE_MEMBER = /not allowed to update this member/i;
const NOT_ALLOWED_TO_INVITE_WITH_ROLE = /not allowed to invite a user with this role/i;
const ONLY_OWNER = /cannot leave the organization as the only owner/i;
const WITHOUT_AN_OWNER = /cannot leave the organization without an owner/i;
const NOT_A_CANONICAL_ROLE = /Role must be exactly one of owner, admin, member/;

/**
 * The role smugglers, in the four shapes Better Auth accepts and stores verbatim.
 * They are cast at the call site because the typed client already narrows `role` to
 * the canonical union — the guard under test is what protects the untyped callers
 * that narrowing cannot reach: raw HTTP, and any future server-side caller.
 */
const SMUGGLED_OWNER_ROLES: [string | string[]][] = [
  [" owner"],
  ["owner "],
  ["member, owner"],
  [["member", " owner"]],
];

const asRole = <T>(role: string | string[]) => role as T;

describe("organization plugin configuration and protection hooks", () => {
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

  async function createOrganization(owner: Signed, overrides: Record<string, unknown> = {}) {
    return auth.api.createOrganization({
      body: { name: "Photosynthesis Lab", slug: uniqueSlug("lab"), ...overrides },
      headers: owner.headers,
    });
  }

  /** An organization with its owner plus a second member holding `admin`. */
  async function orgWithAdmin() {
    const owner = await signIn("owner");
    const admin = await signIn("admin");
    const org = await createOrganization(owner);

    const adminMember = await auth.api.addMember({
      body: { userId: admin.userId, organizationId: org.id, role: "admin" },
    });
    // Asserted, not assumed: every refusal below is only meaningful if the caller
    // really is an admin of this organization.
    expect(adminMember).toMatchObject({
      organizationId: org.id,
      userId: admin.userId,
      role: "admin",
    });

    const [ownerMember] = await testApp.database
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, owner.userId),
        ),
      );

    return { owner, admin, org, adminMemberId: adminMember.id, ownerMemberId: ownerMember.id };
  }

  /** An organization with an owner, an admin, a plain member and one pending invitation. */
  async function orgWithPlainMember() {
    const { owner, admin, org } = await orgWithAdmin();
    const member = await signIn("member");

    const memberRow = await auth.api.addMember({
      body: { userId: member.userId, organizationId: org.id, role: "member" },
    });
    // Asserted, not assumed: the refusals below only mean anything if this caller
    // really is a member of this organization.
    expect(memberRow).toMatchObject({ organizationId: org.id, role: "member" });

    const invitation = await auth.api.createInvitation({
      body: { email: "invitee@example.com", role: "member", organizationId: org.id },
      headers: owner.headers,
    });

    return { owner, admin, member, org, invitation };
  }

  /**
   * What a refused call tells its caller, and nothing else. Two probes that differ
   * only in whether their target exists have to reduce to the same value here.
   */
  async function refusalOf(call: Promise<unknown>) {
    try {
      await call;
    } catch (error) {
      const { status, statusCode, body } = error as APIError;
      return { status, statusCode, body };
    }
    throw new Error("The call was answered rather than refused");
  }

  const invitationsOf = (organizationId: string) =>
    testApp.database
      .select({ id: organizationInvitations.id })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, organizationId));

  describe("slug guard", () => {
    it.each(["Lab", "my lab", "my_lab", "-lab", "lab-", "lab.io"])(
      "refuses to create an organization with the slug %s",
      async (slug) => {
        const owner = await signIn("owner");

        await expect(createOrganization(owner, { slug })).rejects.toThrow(/lowercase letters/);
      },
    );

    it("refuses the reserved personal-workspace namespace", async () => {
      const owner = await signIn("owner");

      // Well-formed and unique, so Better Auth alone would accept it — and the
      // result would be an organization the whole product surface treats as a
      // personal workspace: unlistable, memberless and undeletable.
      await expect(createOrganization(owner, { slug: "personal-lab" })).rejects.toThrow(
        /reserved for personal workspaces/,
      );
    });

    it("refuses to rename an organization into an invalid slug", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);

      await expect(
        auth.api.updateOrganization({
          body: { organizationId: org.id, data: { slug: "personal-lab" } },
          headers: owner.headers,
        }),
      ).rejects.toThrow(/reserved for personal workspaces/);
    });

    it("accepts a well-formed slug", async () => {
      const owner = await signIn("owner");

      const org = await createOrganization(owner, { slug: "photosynthesis-lab-2" });

      expect(org.slug).toBe("photosynthesis-lab-2");
    });
  });

  /**
   * Visibility is chosen when the organization is created, and this is the only place
   * that path is actually executed: everywhere else the client is mocked, and that
   * Better Auth admits `visibility` into a create body at all rests on it being a
   * registered `additionalField` plus a `beforeCreateOrganization` hook whose returned
   * `data` reaches the insert. Both were established by reading Better Auth's source;
   * these go through `auth.api` against a real database, so they are the proof.
   */
  describe("directory visibility", () => {
    it("stores the visibility the create body asked for", async () => {
      const owner = await signIn("owner");

      const org = await createOrganization(owner, { visibility: "public" });

      const [stored] = await testApp.database
        .select({ visibility: organizations.visibility })
        .from(organizations)
        .where(eq(organizations.id, org.id));
      expect(stored.visibility).toBe("public");
    });

    it("lands private when the create body does not say", async () => {
      const owner = await signIn("owner");

      const org = await createOrganization(owner);

      // The hook writes on every create, so this is its default rather than the
      // column's — the two agree, and only one of them is the product rule.
      const [stored] = await testApp.database
        .select({ visibility: organizations.visibility })
        .from(organizations)
        .where(eq(organizations.id, org.id));
      expect(stored.visibility).toBe("private");
    });

    it("refuses a create visibility that is not one of the two states", async () => {
      const owner = await signIn("owner");

      // Refused rather than quietly defaulted: a typo that lands private would
      // publish nothing, but one the other way would, and neither is what was asked.
      await expect(createOrganization(owner, { visibility: "listed" })).rejects.toThrow(
        /'private' or 'public'/,
      );
    });

    it("lets an owner publish the organization", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);

      await auth.api.updateOrganization({
        body: { organizationId: org.id, data: { visibility: "public" } },
        headers: owner.headers,
      });

      // Registered as an organization additionalField: without that the plugin's
      // zod body strips the key and the update 200s while changing nothing.
      const [stored] = await testApp.database
        .select({ visibility: organizations.visibility })
        .from(organizations)
        .where(eq(organizations.id, org.id));
      expect(stored.visibility).toBe("public");
    });

    it("refuses a visibility that is not one of the two states", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);

      await expect(
        auth.api.updateOrganization({
          body: { organizationId: org.id, data: { visibility: "listed" } },
          headers: owner.headers,
        }),
      ).rejects.toThrow(/'private' or 'public'/);
    });
  });

  describe("organization settings are owner-only", () => {
    it("refuses an admin renaming the organization", async () => {
      const { admin, org } = await orgWithAdmin();

      // Better Auth's default admin role carries `organization: ["update"]`; ours
      // deliberately does not, so settings really are the owner's alone.
      await expect(
        auth.api.updateOrganization({
          body: { organizationId: org.id, data: { name: "Taken over" } },
          headers: admin.headers,
        }),
      ).rejects.toThrow(NOT_ALLOWED_TO_UPDATE_ORGANIZATION);
    });

    it("refuses an admin publishing the organization", async () => {
      const { admin, org } = await orgWithAdmin();

      await expect(
        auth.api.updateOrganization({
          body: { organizationId: org.id, data: { visibility: "public" } },
          headers: admin.headers,
        }),
      ).rejects.toThrow(NOT_ALLOWED_TO_UPDATE_ORGANIZATION);
    });

    it("still lets an admin manage members and teams", async () => {
      const { admin, org } = await orgWithAdmin();

      const team = await auth.api.createTeam({
        body: { name: "Field crew", organizationId: org.id },
        headers: admin.headers,
      });

      expect(team.organizationId).toBe(org.id);
    });
  });

  describe("personal workspaces are outside the organization surface", () => {
    async function personalWorkspace() {
      const user = await signIn("solo");
      const organizationId = await ensurePersonalOrganization(testApp.database, {
        id: user.userId,
      });
      return { user, organizationId };
    }

    it("refuses to change its settings", async () => {
      const { user, organizationId } = await personalWorkspace();

      await expect(
        auth.api.updateOrganization({
          body: { organizationId, data: { name: "My lab" } },
          headers: user.headers,
        }),
      ).rejects.toThrow(/Personal workspaces have no settings/);
    });

    it("refuses to publish it to the directory", async () => {
      const { user, organizationId } = await personalWorkspace();

      await expect(
        auth.api.updateOrganization({
          body: { organizationId, data: { visibility: "public" } },
          headers: user.headers,
        }),
      ).rejects.toThrow(/Personal workspaces have no settings/);
    });

    it("refuses to invite anyone into it", async () => {
      const { user, organizationId } = await personalWorkspace();

      await expect(
        auth.api.createInvitation({
          body: { email: "someone@example.com", role: "member", organizationId },
          headers: user.headers,
        }),
      ).rejects.toThrow(/Personal workspaces have no members to invite/);
    });

    it("refuses to add a member to it", async () => {
      const { organizationId } = await personalWorkspace();
      const other = await signIn("other");

      await expect(
        auth.api.addMember({
          body: { userId: other.userId, organizationId, role: "member" },
        }),
      ).rejects.toThrow(/Personal workspaces have no members/);
    });

    it("refuses to create a team in it", async () => {
      const { user, organizationId } = await personalWorkspace();

      await expect(
        auth.api.createTeam({
          body: { name: "Just me", organizationId },
          headers: user.headers,
        }),
      ).rejects.toThrow(/Personal workspaces have no teams/);
    });

    it("refuses to leave it", async () => {
      const { user, organizationId } = await personalWorkspace();

      // Better Auth's sole-owner rule is what refuses it here, and it always will
      // for a workspace of one. The backend adds a hook on the same path so the
      // refusal is about the workspace rather than the head count; that hook is
      // covered separately, since it is Nest wiring rather than plugin config.
      await expect(
        auth.api.leaveOrganization({
          body: { organizationId },
          headers: user.headers,
        }),
      ).rejects.toThrow(ONLY_OWNER);
    });
  });

  describe("deleting an organization", () => {
    /** Every table an organization can own something in, with how to seed one. */
    const OWNED_RESOURCES: [
      string,
      (userId: string, organizationId: string) => Promise<unknown>,
    ][] = [
      [
        "experiment",
        (userId, organizationId) => testApp.createExperiment({ name: "E", userId, organizationId }),
      ],
      [
        "macro",
        (createdBy, organizationId) =>
          testApp.createMacro({ name: "M", createdBy, organizationId }),
      ],
      [
        "protocol",
        (createdBy, organizationId) =>
          testApp.createProtocol({ name: "P", createdBy, organizationId }),
      ],
      [
        "workbook",
        (createdBy, organizationId) =>
          testApp.createWorkbook({ name: "W", createdBy, organizationId }),
      ],
      [
        "device",
        (createdBy, organizationId) => testApp.createIotDevice({ createdBy, organizationId }),
      ],
    ];

    it.each(OWNED_RESOURCES)("refuses while the organization still owns a %s", async (_, seed) => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);
      await seed(owner.userId, org.id);

      // Nothing cascades: a device carries a live AWS Thing and certificate that
      // only its own delete path tears down, and published work should not
      // disappear behind one confirm dialog.
      await expect(
        auth.api.deleteOrganization({
          body: { organizationId: org.id },
          headers: owner.headers,
        }),
      ).rejects.toThrow(/still owns 1 resource/);

      expect(
        await testApp.database
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.id, org.id)),
      ).toHaveLength(1);
    });

    it("counts every type it still owns in the refusal", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);
      await testApp.createMacro({ name: "M", createdBy: owner.userId, organizationId: org.id });
      await testApp.createMacro({ name: "M2", createdBy: owner.userId, organizationId: org.id });
      await testApp.createIotDevice({ createdBy: owner.userId, organizationId: org.id });

      await expect(
        auth.api.deleteOrganization({
          body: { organizationId: org.id },
          headers: owner.headers,
        }),
      ).rejects.toThrow(/still owns 3 resources \(2 macros, 1 device\)/);
    });

    it("refuses to delete a personal workspace", async () => {
      const user = await signIn("solo");
      const organizationId = await ensurePersonalOrganization(testApp.database, {
        id: user.userId,
      });

      await expect(
        auth.api.deleteOrganization({
          body: { organizationId },
          headers: user.headers,
        }),
      ).rejects.toThrow(/Personal workspaces cannot be deleted/);
    });

    it("refuses an admin, so deletion stays the owner's alone", async () => {
      const { admin, org } = await orgWithAdmin();

      // Better Auth checks `organization:delete`, which our admin role does not
      // carry — the hook never even runs.
      await expect(
        auth.api.deleteOrganization({
          body: { organizationId: org.id },
          headers: admin.headers,
        }),
      ).rejects.toThrow(/not allowed to delete this organization/i);
    });

    it("deletes an empty organization and leaves no grant naming it behind", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);
      const team = await auth.api.createTeam({
        body: { name: "Field crew", organizationId: org.id },
        headers: owner.headers,
      });
      // Something the organization was granted access to but does not own — the
      // rows that survive it, since `resource_grants.grantee_id` has no foreign
      // key and nothing cascades from the grantee side.
      const macro = await testApp.createMacro({ name: "M", createdBy: owner.userId });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "organization",
        granteeId: org.id,
        role: "viewer",
      });
      // Seeded straight in: no product path leaves a team grant on a resource the
      // team's organization does not own, which is exactly why nothing else would
      // ever come back for this row.
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "team",
        granteeId: team.id,
        role: "viewer",
      });
      // A person's own grant on the same resource. The teardown is scoped to the
      // organization and its teams, and a member losing their organization must not
      // cost them access they hold in their own name.
      const collaborator = await signIn("collaborator");
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator.userId,
        role: "viewer",
      });

      await auth.api.deleteOrganization({
        body: { organizationId: org.id },
        headers: owner.headers,
      });

      // Only the two rows naming the organization and its team are gone; the
      // person's own grant is untouched.
      expect(
        await testApp.database
          .select({
            granteeType: resourceGrants.granteeType,
            granteeId: resourceGrants.granteeId,
          })
          .from(resourceGrants)
          .where(eq(resourceGrants.resourceId, macro.id)),
      ).toEqual([{ granteeType: "user", granteeId: collaborator.userId }]);
    });

    it("keeps the grants when the delete is refused", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);
      const macro = await testApp.createMacro({ name: "M", createdBy: owner.userId });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "organization",
        granteeId: org.id,
        role: "viewer",
      });
      // Owning a device blocks the delete; the teardown must not have run anyway.
      await testApp.createIotDevice({ createdBy: owner.userId, organizationId: org.id });

      await expect(
        auth.api.deleteOrganization({
          body: { organizationId: org.id },
          headers: owner.headers,
        }),
      ).rejects.toThrow(/still owns/);

      expect(
        await testApp.database
          .select({ id: resourceGrants.id })
          .from(resourceGrants)
          .where(eq(resourceGrants.resourceId, macro.id)),
      ).toHaveLength(1);
    });
  });

  describe("teams", () => {
    it("deletes the grants naming a team when the team goes", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);
      const team = await auth.api.createTeam({
        body: { name: "Field crew", organizationId: org.id },
        headers: owner.headers,
      });
      const macro = await testApp.createMacro({
        name: "M",
        createdBy: owner.userId,
        organizationId: org.id,
      });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "team",
        granteeId: team.id,
        role: "viewer",
      });

      await auth.api.removeTeam({
        body: { teamId: team.id, organizationId: org.id },
        headers: owner.headers,
      });

      expect(
        await testApp.database
          .select({ id: resourceGrants.id })
          .from(resourceGrants)
          .where(eq(resourceGrants.resourceId, macro.id)),
      ).toEqual([]);
    });

    it("creates no default team with the organization", async () => {
      const owner = await signIn("owner");

      const org = await createOrganization(owner);

      // With `teams.enabled` and no `defaultTeam` setting, Better Auth would create
      // a team named after the organization and put the creator in it — a team
      // nobody made, showing up in the teams list and the grantee picker.
      expect(
        await testApp.database
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.organizationId, org.id)),
      ).toEqual([]);
    });
  });

  describe("invitations", () => {
    /**
     * Better Auth's own `list-invitations` requires only *some* membership and then
     * returns every invitee's address, role and expiry. openJII treats Invited as a
     * management view, so the plugin re-authorizes that read — and its gating is the
     * only thing that makes it a management view: the web client decides what to
     * render, never what the endpoint will answer. `get-full-organization` carries
     * the same rows and is narrowed to the same rule, below.
     */
    describe("invitation visibility", () => {
      it("refuses a plain member the organization's pending invitations", async () => {
        const { member, org } = await orgWithPlainMember();

        await expect(
          auth.api.listInvitations({ query: { organizationId: org.id }, headers: member.headers }),
        ).rejects.toThrow(/owners and admins can see its pending invitations/i);
      });

      it("refuses a stranger with the same answer as a member", async () => {
        const { org } = await orgWithPlainMember();
        const stranger = await signIn("stranger");

        // Identical refusal on purpose: which of the two the caller is would itself
        // say whether an organization with that id exists.
        await expect(
          auth.api.listInvitations({
            query: { organizationId: org.id },
            headers: stranger.headers,
          }),
        ).rejects.toThrow(/owners and admins can see its pending invitations/i);
      });

      it.each(["owner", "admin"] as const)("still lets an %s read them", async (role) => {
        const context = await orgWithPlainMember();
        const caller = role === "owner" ? context.owner : context.admin;

        const invitations = await auth.api.listInvitations({
          query: { organizationId: context.org.id },
          headers: caller.headers,
        });

        expect(invitations).toEqual([
          expect.objectContaining({ id: context.invitation.id, email: "invitee@example.com" }),
        ]);
      });
    });

    it("expires an invitation 48 hours out", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);

      const invitation = await auth.api.createInvitation({
        body: { email: "invitee@example.com", role: "member", organizationId: org.id },
        headers: owner.headers,
      });

      const hours = (invitation.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000);
      expect(hours).toBeGreaterThan(47);
      expect(hours).toBeLessThan(49);
    });

    it("lets an unverified account accept its invitation", async () => {
      const owner = await signIn("owner");
      const org = await createOrganization(owner);
      const invitee = await signIn("invitee");
      // What an OAuth sign-up whose provider email came back unverified looks like.
      // Left to its own inference Better Auth would refuse the accept outright, and
      // with password sign-in disabled there would be no way to verify.
      await testApp.database
        .update(schema.users)
        .set({ emailVerified: false })
        .where(eq(schema.users.id, invitee.userId));

      const invitation = await auth.api.createInvitation({
        body: { email: invitee.email, role: "member", organizationId: org.id },
        headers: owner.headers,
      });
      await auth.api.acceptInvitation({
        body: { invitationId: invitation.id },
        headers: invitee.headers,
      });

      const [membership] = await testApp.database
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.userId, invitee.userId),
          ),
        );
      expect(membership.role).toBe("member");
    });

    it("refuses an admin inviting somebody as owner", async () => {
      const { admin, org } = await orgWithAdmin();

      await expect(
        auth.api.createInvitation({
          body: { email: "successor@example.com", role: "owner", organizationId: org.id },
          headers: admin.headers,
        }),
      ).rejects.toThrow(NOT_ALLOWED_TO_INVITE_WITH_ROLE);

      expect(await invitationsOf(org.id)).toEqual([]);
    });

    /**
     * Better Auth validates the requested roles after trimming but gates who may
     * hand out the creator role on the raw string, so each of these slips past its
     * check and is stored verbatim. Every reader in openJII trims, so the invitee
     * would come out an owner that Better Auth's permission check and last-owner
     * counters do not see.
     */
    it.each(SMUGGLED_OWNER_ROLES)(
      "refuses an admin smuggling owner past the role check as %j",
      async (role) => {
        const { admin, org } = await orgWithAdmin();

        await expect(
          auth.api.createInvitation({
            body: {
              email: "successor@example.com",
              role: asRole<"member">(role),
              organizationId: org.id,
            },
            headers: admin.headers,
          }),
        ).rejects.toThrow(NOT_A_CANONICAL_ROLE);

        expect(await invitationsOf(org.id)).toEqual([]);
      },
    );

    it("still lets an admin invite a plain member", async () => {
      const { admin, org } = await orgWithAdmin();

      const invitation = await auth.api.createInvitation({
        body: { email: "newcomer@example.com", role: "member", organizationId: org.id },
        headers: admin.headers,
      });

      expect(invitation.role).toBe("member");
    });

    it.each(SMUGGLED_OWNER_ROLES)(
      "refuses to add a member with the non-canonical role %j",
      async (role) => {
        const { org } = await orgWithAdmin();
        const newcomer = await signIn("newcomer");

        // Better Auth's add-member endpoint has no role check whatsoever, so this
        // is the only thing standing between a caller and an unreadable role row.
        await expect(
          auth.api.addMember({
            body: {
              userId: newcomer.userId,
              organizationId: org.id,
              role: asRole<"member">(role),
            },
          }),
        ).rejects.toThrow(NOT_A_CANONICAL_ROLE);

        expect(
          await testApp.database
            .select({ userId: organizationMembers.userId })
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.organizationId, org.id),
                eq(organizationMembers.userId, newcomer.userId),
              ),
            ),
        ).toEqual([]);
      },
    );

    /**
     * Better Auth validates each token of a role update and would accept this one:
     * every token is a real role. What it stores is the list, which every openJII
     * reader splits but the roster renders verbatim.
     */
    it("refuses to re-role a member into a list of otherwise-valid roles", async () => {
      const { owner, org, adminMemberId } = await orgWithAdmin();

      await expect(
        auth.api.updateMemberRole({
          body: {
            memberId: adminMemberId,
            role: asRole<"member">("admin,member"),
            organizationId: org.id,
          },
          headers: owner.headers,
        }),
      ).rejects.toThrow(NOT_A_CANONICAL_ROLE);

      const [stored] = await testApp.database
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, adminMemberId));
      expect(stored.role).toBe("admin");
    });

    it("still re-roles a member into one canonical role", async () => {
      const { owner, org, adminMemberId } = await orgWithAdmin();

      await auth.api.updateMemberRole({
        body: { memberId: adminMemberId, role: "member", organizationId: org.id },
        headers: owner.headers,
      });

      const [stored] = await testApp.database
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, adminMemberId));
      expect(stored.role).toBe("member");
    });
  });

  /**
   * `get-full-organization` joins the same invitation rows into its payload and gates
   * only on membership, so on its own it hands a plain member exactly what
   * `list-invitations` withholds — and refuses a stranger differently depending on
   * whether the organization exists, which makes the route an existence oracle over
   * both ids and slugs.
   */
  describe("reading the full organization", () => {
    const NOT_A_MEMBER = /only an organization's members can read it/i;

    it("withholds the invitations from a plain member", async () => {
      const { member, org } = await orgWithPlainMember();

      const full = await auth.api.getFullOrganization({
        query: { organizationId: org.id },
        headers: member.headers,
      });

      // The organization itself stays readable; only the invitee list is withheld.
      expect(full).toMatchObject({ id: org.id });
      expect(full?.members).toHaveLength(3);
      expect(full).not.toHaveProperty("invitations");
    });

    it.each(["owner", "admin"] as const)("still hands an %s the invitations", async (role) => {
      const context = await orgWithPlainMember();
      const caller = role === "owner" ? context.owner : context.admin;

      const full = await auth.api.getFullOrganization({
        query: { organizationId: context.org.id },
        headers: caller.headers,
      });

      expect(full?.invitations).toEqual([
        expect.objectContaining({ id: context.invitation.id, email: "invitee@example.com" }),
      ]);
    });

    it("refuses a stranger an id that exists exactly as one that does not", async () => {
      const { org } = await orgWithPlainMember();
      const stranger = await signIn("stranger");

      const existing = await refusalOf(
        auth.api.getFullOrganization({
          query: { organizationId: org.id },
          headers: stranger.headers,
        }),
      );
      const fabricated = await refusalOf(
        auth.api.getFullOrganization({
          query: { organizationId: crypto.randomUUID() },
          headers: stranger.headers,
        }),
      );

      // Identical down to the status: any difference would answer whether the id
      // names an organization. Better Auth alone says 403 for one and 400 for the other.
      expect(fabricated).toEqual(existing);
      expect(existing.body?.message).toMatch(NOT_A_MEMBER);
    });

    it("refuses a stranger a slug that exists exactly as one that does not", async () => {
      const { org } = await orgWithPlainMember();
      const stranger = await signIn("stranger");

      const existing = await refusalOf(
        auth.api.getFullOrganization({
          query: { organizationSlug: org.slug },
          headers: stranger.headers,
        }),
      );
      const fabricated = await refusalOf(
        auth.api.getFullOrganization({
          query: { organizationSlug: uniqueSlug("nowhere") },
          headers: stranger.headers,
        }),
      );

      expect(fabricated).toEqual(existing);
      expect(existing.body?.message).toMatch(NOT_A_MEMBER);
    });

    /**
     * Better Auth reads the slug ahead of the id, so a member of one organization
     * pairing their own id with somebody else's slug would otherwise probe with a
     * membership the gate had already accepted.
     */
    it("refuses a member probing another organization's slug behind their own id", async () => {
      const { member, org } = await orgWithPlainMember();
      const other = await createOrganization(await signIn("outsider"));

      const existing = await refusalOf(
        auth.api.getFullOrganization({
          query: { organizationId: org.id, organizationSlug: other.slug },
          headers: member.headers,
        }),
      );
      const fabricated = await refusalOf(
        auth.api.getFullOrganization({
          query: { organizationId: org.id, organizationSlug: uniqueSlug("nowhere") },
          headers: member.headers,
        }),
      );

      expect(fabricated).toEqual(existing);
      expect(existing.body?.message).toMatch(NOT_A_MEMBER);
    });
  });

  describe("last-owner protection", () => {
    it("refuses to remove the only owner", async () => {
      const { owner, org } = await orgWithAdmin();

      await expect(
        auth.api.removeMember({
          body: { memberIdOrEmail: owner.email, organizationId: org.id },
          headers: owner.headers,
        }),
      ).rejects.toThrow(ONLY_OWNER);
    });

    it("refuses to let the only owner demote themselves", async () => {
      const { owner, org, ownerMemberId } = await orgWithAdmin();

      await expect(
        auth.api.updateMemberRole({
          body: { memberId: ownerMemberId, role: "member", organizationId: org.id },
          headers: owner.headers,
        }),
      ).rejects.toThrow(WITHOUT_AN_OWNER);
    });

    it("refuses to let the only owner leave", async () => {
      const { owner, org } = await orgWithAdmin();

      await expect(
        auth.api.leaveOrganization({
          body: { organizationId: org.id },
          headers: owner.headers,
        }),
      ).rejects.toThrow(ONLY_OWNER);
    });

    it("refuses to let an admin re-role the owner", async () => {
      const { admin, org, ownerMemberId } = await orgWithAdmin();

      await expect(
        auth.api.updateMemberRole({
          body: { memberId: ownerMemberId, role: "member", organizationId: org.id },
          headers: admin.headers,
        }),
      ).rejects.toThrow(NOT_ALLOWED_TO_UPDATE_MEMBER);
    });

    it("lets an admin leave", async () => {
      const { admin, org } = await orgWithAdmin();

      await auth.api.leaveOrganization({
        body: { organizationId: org.id },
        headers: admin.headers,
      });

      expect(
        await testApp.database
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, org.id),
              eq(organizationMembers.userId, admin.userId),
            ),
          ),
      ).toEqual([]);
    });
  });
});
