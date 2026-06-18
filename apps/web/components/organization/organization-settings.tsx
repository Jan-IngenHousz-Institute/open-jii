"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authClient, useSession } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string; image: string | null };
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
}

const MANAGER_ROLES = new Set(["owner", "admin"]);
const ASSIGNABLE_ROLES = ["member", "admin", "owner"] as const;

/**
 * Organization management: members, roles, and invitations for the active org.
 * Backed directly by the Better Auth organization plugin client.
 */
export function OrganizationSettings() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const organizationId = activeOrg?.id;

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>("member");

  const fullOrg = useQuery({
    queryKey: ["org-full", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("No active organization");
      }
      const res = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to load organization");
      }
      return res.data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["org-full", organizationId] });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to invite");
      }
    },
    onSuccess: async () => {
      setInviteEmail("");
      await invalidate();
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberIdOrEmail: string) => {
      await authClient.organization.removeMember({ memberIdOrEmail, organizationId });
    },
    onSuccess: invalidate,
  });

  const updateRole = useMutation({
    mutationFn: async (vars: { memberId: string; role: string }) => {
      await authClient.organization.updateMemberRole({
        memberId: vars.memberId,
        role: vars.role,
        organizationId,
      });
    },
    onSuccess: invalidate,
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      await authClient.organization.cancelInvitation({ invitationId });
    },
    onSuccess: invalidate,
  });

  const members = (fullOrg.data?.members ?? []) as OrgMember[];
  const invitations = (fullOrg.data?.invitations ?? []) as OrgInvitation[];
  const myRole = members.find((m) => m.userId === session?.user.id)?.role ?? "";
  const canManage = myRole
    .split(",")
    .map((r) => r.trim())
    .some((r) => MANAGER_ROLES.has(r));

  if (!organizationId) {
    return <p className="text-muted-foreground text-sm">No active organization.</p>;
  }

  return (
    <section aria-label="Organization members" className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">{activeOrg.name}</h2>
        <p className="text-muted-foreground text-sm">Manage members and invitations.</p>
      </header>

      <div className="space-y-2">
        <h3 className="font-medium">Members</h3>
        {fullOrg.isPending ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  <span className="font-medium">{m.user.name}</span>{" "}
                  <span className="text-muted-foreground">{m.user.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  {canManage ? (
                    <select
                      aria-label={`Role for ${m.user.email}`}
                      value={m.role}
                      onChange={(e) => updateRole.mutate({ memberId: m.id, role: e.target.value })}
                      className="h-8 rounded-md border px-2 text-sm"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-medium">{m.role}</span>
                  )}
                  {canManage && m.userId !== session?.user.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removeMember.isPending}
                      onClick={() => removeMember.mutate(m.user.email)}
                      aria-label={`Remove ${m.user.email}`}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Pending invitations</h3>
          <ul className="divide-y rounded-md border">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm">
                  {inv.email}{" "}
                  <span className="text-muted-foreground">({inv.role ?? "member"})</span>
                </span>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancelInvite.isPending}
                    onClick={() => cancelInvite.mutate(inv.id)}
                    aria-label={`Cancel invitation for ${inv.email}`}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (inviteEmail.trim()) {
              invite.mutate();
            }
          }}
        >
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@example.com"
            aria-label="Invite email"
            className="h-9 flex-1 rounded-md border px-3 text-sm focus:outline-none"
          />
          <select
            aria-label="Invite role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as (typeof ASSIGNABLE_ROLES)[number])}
            className="h-9 rounded-md border px-2 text-sm"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={invite.isPending || !inviteEmail.trim()}>
            Invite
          </Button>
        </form>
      )}
    </section>
  );
}
