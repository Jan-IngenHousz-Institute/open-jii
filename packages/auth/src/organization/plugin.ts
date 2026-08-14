import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { organization as organizationPlugin } from "better-auth/plugins";

import { ac, roles } from "../access";
import { sendOrganizationInvitationEmail } from "../email/invitationEmail";
import {
  assertCanListInvitations,
  assertCanReadOrganization,
  assertCanonicalOrgRole,
  assertNotPersonalOrganization,
  assertSlugAllowed,
  assertVisibilityChangeAllowed,
  canListInvitations,
  findOrganizationSlug,
  resolveCreateVisibility,
} from "./guards";
import {
  assertOrganizationIsDeletable,
  assertOrganizationOwnsNoResources,
  tearDownOrganizationGrants,
  tearDownTeamGrants,
} from "./lifecycle";

const clientUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/** The read paths this plugin re-authorizes. Matched by exact equality. */
const LIST_INVITATIONS_PATH = "/organization/list-invitations";
const GET_FULL_ORGANIZATION_PATH = "/organization/get-full-organization";

/**
 * The organization plugin as openJII configures it: the permission matrix, the
 * profile/visibility fields, the invitation email, and the protection hooks that
 * keep personal workspaces and organization settings out of reach.
 *
 * Built here rather than inline in the auth instance so the rules can be driven by
 * a real Better Auth instance in tests without standing up the whole server config.
 */
export const openJiiOrganization = () => {
  const plugin = organizationPlugin({
    allowUserToCreateOrganization: true,
    creatorRole: "owner",
    // `defaultTeam` off: with teams enabled Better Auth otherwise creates a team
    // named after the organization on every create, which would show up in the
    // teams list and the grantee picker as a team nobody made.
    // `allowRemovingAllTeams` because there is no team an organization is
    // supposed to keep: with `defaultTeam` off every team is one somebody made,
    // and Better Auth would otherwise refuse to remove the last of them, leaving
    // whoever created one team stuck with it for good.
    teams: { enabled: true, defaultTeam: { enabled: false }, allowRemovingAllTeams: true },
    // Better Auth's own defaults, set here so they are a decision rather than an
    // inherited number, and so the limits are visible next to the surface they cap.
    membershipLimit: 100,
    invitationLimit: 100,
    invitationExpiresIn: 60 * 60 * 48,
    // Set explicitly: left unset, Better Auth infers it from
    // `advanced.database.generateId` (ours is `false`) and starts demanding a
    // verified email to accept or reject — which an OAuth account with an unverified
    // provider email can never satisfy, since password sign-in is disabled.
    requireEmailVerificationOnInvitation: false,
    // Single permission matrix (replaces the backend's hand-rolled abilities):
    // org roles owner/admin → full control, member → read, across every
    // openJII resource type. See packages/auth/src/access.ts.
    ac,
    roles,
    // openJII org profile fields, persisted in one organization.create call.
    // Anything not listed here is stripped from create/update bodies by the
    // plugin's zod schema, so a field missing from this list silently no-ops.
    schema: {
      organization: {
        additionalFields: {
          type: { type: "string", required: false, input: true },
          description: { type: "string", required: false, input: true },
          website: { type: "string", required: false, input: true },
          location: { type: "string", required: false, input: true },
          visibility: { type: "string", required: false, input: true },
        },
      },
    },
    async sendInvitationEmail({ id, email, role, organization, inviter }) {
      const emailServer = process.env.AUTH_EMAIL_SERVER;
      const emailFrom = process.env.AUTH_EMAIL_FROM;
      if (!emailServer || !emailFrom) return;

      const { href: inviteUrl } = new URL(`/platform/accept-invitation/${id}`, clientUrl);

      await sendOrganizationInvitationEmail({
        to: email,
        inviteUrl,
        organizationName: organization.name,
        inviterName: inviter.user.name || inviter.user.email,
        role,
        emailServer,
        emailFrom,
        senderName: "openJII",
        baseUrl: clientUrl,
      });
    },
    organizationHooks: {
      beforeCreateOrganization({ organization }) {
        if (typeof organization.slug === "string") assertSlugAllowed(organization.slug);
        // Written on every create, so the column's default never decides.
        return Promise.resolve({
          data: { visibility: resolveCreateVisibility(organization.visibility) },
        });
      },
      async beforeUpdateOrganization({ organization: update, member }) {
        const slug = await findOrganizationSlug(member.organizationId);
        assertNotPersonalOrganization(slug, "settings");
        if (typeof update.slug === "string") assertSlugAllowed(update.slug);
        if (update.visibility !== undefined) {
          assertVisibilityChangeAllowed(update.visibility, member.role);
        }
      },
      beforeCreateInvitation({ invitation, organization }) {
        assertNotPersonalOrganization(organization.slug, "members to invite");
        assertCanonicalOrgRole(invitation.role);
        return Promise.resolve();
      },
      beforeAddMember({ member, organization }) {
        assertNotPersonalOrganization(organization.slug, "members");
        // Better Auth's add-member path has no role check of its own at all.
        assertCanonicalOrgRole(member.role);
        return Promise.resolve();
      },
      // The last membership write without the guard. Better Auth accepts a
      // comma-joined list of otherwise-valid roles here and stores it verbatim, which
      // every reader then splits but the roster renders as-is.
      beforeUpdateMemberRole({ newRole }) {
        assertCanonicalOrgRole(newRole);
        return Promise.resolve();
      },
      beforeCreateTeam({ organization }) {
        // Teams only ever exist inside a real organization, so blocking creation
        // here is what makes every other team operation unreachable for a
        // personal workspace.
        assertNotPersonalOrganization(organization.slug, "teams");
        return Promise.resolve();
      },
      /**
       * Better Auth has already established that the caller holds
       * `organization:delete`, which only the owner role carries here. What is
       * left is whether the organization may go at all.
       */
      async beforeDeleteOrganization({ organization }) {
        assertOrganizationIsDeletable(organization.slug);
        await assertOrganizationOwnsNoResources(organization.id);
      },
      // After, not before: a refused delete must leave the grants it would have
      // torn down exactly where they were.
      async afterDeleteOrganization({ organization }) {
        await tearDownOrganizationGrants(organization.id);
      },
      async afterDeleteTeam({ team }) {
        await tearDownTeamGrants(team.id);
      },
    },
  });

  /**
   * `organizationHooks` cover the plugin's writes only — there is no read hook among
   * them — so the reads that need narrowing are re-authorized here, on the plugin's
   * own request pipeline: `before` to refuse ahead of Better Auth's endpoint, `after`
   * to withhold part of what it answered.
   *
   * Attached to the plugin rather than to the auth instance so that anything
   * mounting `openJiiOrganization()` — the server config and the tests alike —
   * carries the gates with it.
   */
  // Better Auth's shared plugin type declares `hooks` as optional, but the
  // organization plugin's concrete return type omits the key — so its own hooks
  // (none in 1.6.23) are read through that shared shape rather than assumed absent,
  // and a version that starts declaring some is carried through instead of clobbered.
  const declaredHooks: BetterAuthPlugin["hooks"] = (plugin as BetterAuthPlugin).hooks;

  return {
    ...plugin,
    hooks: {
      ...declaredHooks,
      before: [
        ...(declaredHooks?.before ?? []),
        {
          // `path` is optional on the shared hook context (a virtual endpoint has
          // none), so the comparison is against the literal rather than the reverse.
          matcher: (ctx: { path?: string }) => ctx.path === LIST_INVITATIONS_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (!session) {
              throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
            }

            // Better Auth resolves the target the same way: the query parameter, then
            // the session's active organization. With no active organization in this
            // product that second branch is normally empty, and Better Auth itself
            // refuses the call — so there is nothing here to authorize.
            //
            // Both are read through explicit narrowings: the hook context is generic
            // over every endpoint, and `activeOrganizationId` is an additional field
            // this plugin contributes, so neither is typed at this point.
            const query = ctx.query as { organizationId?: string } | undefined;
            const activeOrganizationId = (
              session.session as { activeOrganizationId?: string | null }
            ).activeOrganizationId;
            const organizationId = query?.organizationId ?? activeOrganizationId ?? null;
            if (!organizationId) return;

            await assertCanListInvitations(organizationId, session.user.id);
          }),
        },
        {
          matcher: (ctx: { path?: string }) => ctx.path === GET_FULL_ORGANIZATION_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (!session) {
              throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
            }

            const query = ctx.query as
              | { organizationId?: string; organizationSlug?: string }
              | undefined;
            const activeOrganizationId = (
              session.session as { activeOrganizationId?: string | null }
            ).activeOrganizationId;
            // Better Auth's own precedence, mirrored: a slug outranks an id, so
            // authorizing the id would leave the slug it actually reads unchecked.
            const isSlug = Boolean(query?.organizationSlug);
            const target = isSlug
              ? query?.organizationSlug
              : (query?.organizationId ?? activeOrganizationId);
            // Nothing named at all: Better Auth answers `null` without reading a row.
            if (!target) return;

            await assertCanReadOrganization({ value: target, isSlug }, session.user.id);
          }),
        },
      ],
      after: [
        ...(declaredHooks?.after ?? []),
        {
          matcher: (ctx: { path?: string }) => ctx.path === GET_FULL_ORGANIZATION_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            // The membership the `before` gate established is enough to reach the
            // organization, not to see who it has invited.
            const returned = ctx.context.returned;
            if (typeof returned !== "object" || returned === null) return;
            if (!("invitations" in returned)) return;

            // Read back rather than taken from the payload: the caller chooses
            // `membersLimit`, so its roster need not carry their own row.
            const session = await getSessionFromCtx(ctx);
            const { id } = returned as { id?: unknown };
            const mayRead =
              session !== null &&
              typeof id === "string" &&
              (await canListInvitations(id, session.user.id));
            if (mayRead) return;

            const { invitations: _withheld, ...rest } = returned;
            ctx.context.returned = rest;
          }),
        },
      ],
    },
  };
};
