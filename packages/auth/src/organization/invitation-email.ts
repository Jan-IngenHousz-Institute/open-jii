import { sendOrganizationInvitationEmail } from "../email/invitationEmail";
import { hasAccountForEmail } from "./guards";

/**
 * What Better Auth hands `sendInvitationEmail`, narrowed to the parts this needs.
 * Wider than the plugin's own type on purpose, so a Better Auth release that adds
 * fields still type-checks.
 */
interface InvitationEmailData {
  email: string;
  role: string;
  organization: { name: string };
  inviter: { user: { name?: string | null; email: string } };
}

/**
 * The invitation email, for the half of invitees the backend cannot reach.
 *
 * Who sends this email is split by one predicate: does an openJII account already
 * exist for the address. An invitee who has one is emailed by the backend, from
 * notification dispatch, where their saved "Requests and invitations" preference is
 * read and a bell row is written alongside. An invitee who has none can hold no
 * preference and cannot be a dispatch recipient — dispatch addresses user ids — so
 * they are emailed from here, and hear nothing else until they sign up.
 *
 * The backend's `@AfterHook("/organization/invite-member")` applies the same
 * predicate, written out a second time because this plugin runs outside Nest and
 * cannot call backend code. If the two ever disagree, somebody is emailed twice or
 * not at all.
 *
 * Lives beside the plugin rather than inline in its options so both branches can be
 * driven directly; nothing in the backend suite can reach this code, because
 * `packages/auth` is consumed there as build output.
 */
export async function sendInvitationEmailUnlessAccountExists(
  data: InvitationEmailData,
): Promise<void> {
  const emailServer = process.env.AUTH_EMAIL_SERVER;
  const emailFrom = process.env.AUTH_EMAIL_FROM;
  if (!emailServer || !emailFrom) return;

  if (await hasAccountForEmail(data.email)) return;

  const clientUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  // The account tab that lists every invitation waiting for the address the
  // recipient signs in with — not a per-invitation route. The id would add
  // nothing: whoever follows this link sees this invitation among their own, and
  // an id belonging to somebody else's address could only ever be refused.
  const { href: inviteUrl } = new URL("/platform/account/invitations", clientUrl);

  await sendOrganizationInvitationEmail({
    to: data.email,
    inviteUrl,
    organizationName: data.organization.name,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- an account that never set a name carries `""`, which `??` would keep.
    inviterName: data.inviter.user.name || data.inviter.user.email,
    role: data.role,
    emailServer,
    emailFrom,
    senderName: "openJII",
    baseUrl: clientUrl,
  });
}
