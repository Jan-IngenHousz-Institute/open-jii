"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
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

/** Teams within an organization: list + create (owner/admin). */
export function OrganizationTeams({ organizationId, canManage }: OrganizationTeamsProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const teamsQuery = useQuery({
    queryKey: ["org-teams", organizationId],
    queryFn: async () => {
      const res = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to load teams");
      return res.data.teams as Team[];
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
      await queryClient.invalidateQueries({ queryKey: ["org-teams", organizationId] });
    },
    onError: (err: Error) => toast({ description: err.message, variant: "destructive" }),
  });

  const teams = teamsQuery.data ?? [];

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
            <div key={team.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-full">
                <Users className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-medium">{team.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
