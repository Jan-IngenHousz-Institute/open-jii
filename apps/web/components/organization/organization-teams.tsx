"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Users } from "lucide-react";
import { useState } from "react";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/hooks/use-toast";

interface OrganizationTeamsProps {
  organizationId: string;
  canManage: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface OrgMember {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
}

export function OrganizationTeams({ organizationId, canManage }: OrganizationTeamsProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fullOrg = useQuery({
    queryKey: ["org-full", organizationId],
    queryFn: async () => {
      const res = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to load teams");
      return res.data;
    },
  });

  const createTeam = useMutation({
    mutationFn: async () => {
      const res = await authClient.organization.createTeam({
        name: name.trim(),
        organizationId,
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to create team");
    },
    onSuccess: async () => {
      setName("");
      toast({ description: "Team created" });
      await queryClient.invalidateQueries({ queryKey: ["org-full", organizationId] });
    },
    onError: (err: Error) => toast({ description: err.message, variant: "destructive" }),
  });

  const teams = (fullOrg.data?.teams ?? []) as Team[];
  const orgMembers = (fullOrg.data?.members ?? []) as OrgMember[];

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team name"
            aria-label="New team name"
          />
          <Button
            onClick={() => createTeam.mutate()}
            disabled={name.trim().length === 0 || createTeam.isPending}
          >
            <Plus className="h-4 w-4" />
            Create team
          </Button>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-foreground text-sm font-semibold">No teams yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Teams let you share resources with a sub-group of the organization.
          </p>
        </div>
      ) : (
        <div className="divide-border divide-y overflow-hidden rounded-lg border">
          {teams.map((team) => (
            <div key={team.id}>
              <button
                type="button"
                onClick={() => setExpanded((cur) => (cur === team.id ? null : team.id))}
                aria-expanded={expanded === team.id}
                className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-full">
                  <Users className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate text-sm font-medium">{team.name}</span>
                {expanded === team.id ? (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                )}
              </button>
              {expanded === team.id && (
                <TeamMembers
                  organizationId={organizationId}
                  teamId={team.id}
                  canManage={canManage}
                  orgMembers={orgMembers}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamMembers({
  organizationId,
  teamId,
  canManage,
  orgMembers,
}: {
  organizationId: string;
  teamId: string;
  canManage: boolean;
  orgMembers: OrgMember[];
}) {
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState("");

  const membersQuery = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      const res = await authClient.organization.listTeamMembers({ query: { teamId } });
      if (res.error) throw new Error(res.error.message ?? "Failed to load team members");
      return res.data as { id: string; userId: string }[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const res = await authClient.organization.addTeamMember({ teamId, userId, organizationId });
      if (res.error) throw new Error(res.error.message ?? "Failed to add member");
    },
    onSuccess: async () => {
      setAddUserId("");
      await invalidate();
    },
    onError: (err: Error) => toast({ description: err.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const res = await authClient.organization.removeTeamMember({
        teamId,
        userId,
        organizationId,
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to remove member");
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast({ description: err.message, variant: "destructive" }),
  });

  const memberUserIds = new Set((membersQuery.data ?? []).map((m) => m.userId));
  const nameFor = (userId: string) => {
    const found = orgMembers.find((m) => m.userId === userId);
    return found ? found.user.name : userId;
  };
  const addable = orgMembers.filter((m) => !memberUserIds.has(m.userId));

  return (
    <div className="bg-muted/30 space-y-3 px-3 py-3">
      {membersQuery.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (membersQuery.data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No members in this team yet.</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border bg-white">
          {(membersQuery.data ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-sm">{nameFor(m.userId)}</span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate(m.userId)}
                  aria-label={`Remove ${nameFor(m.userId)} from team`}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Add team member"
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="h-9 flex-1 rounded-md border px-2 text-sm"
          >
            <option value="">Select a member…</option>
            {addable.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name} ({m.user.email})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!addUserId || addMember.isPending}
            onClick={() => addMember.mutate(addUserId)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
