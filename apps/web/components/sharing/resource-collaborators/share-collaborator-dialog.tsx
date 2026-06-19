"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useGrantResource } from "~/hooks/sharing/useGrantResource";
import { useInviteResourceUser } from "~/hooks/sharing/useInviteResourceUser";
import { useDebounce } from "~/hooks/useDebounce";
import { useUserSearch } from "~/hooks/useUserSearch";

import type {
  GranteeTypeValue,
  GrantRoleValue,
  ResourceTypeValue,
} from "@repo/api/schemas/sharing.schema";
import type { UserProfile } from "@repo/api/schemas/user.schema";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import { UserSearchPopover } from "../../user-search-popover";

type Mode = Exclude<GranteeTypeValue, never>;

type Selection = { type: "user"; user: UserProfile } | { type: "email"; email: string } | null;

interface ShareCollaboratorDialogProps {
  resourceType: ResourceTypeValue;
  resourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grantee ids already on the resource, to filter out of the pickers. */
  grantedIds: Set<string>;
  /** Which picker the dialog opens on (Add people → user, Add teams → team). */
  initialMode?: Mode;
}

const MODES: { value: Mode; label: string; icon: typeof Users }[] = [
  { value: "user", label: "People", icon: Users },
  { value: "team", label: "Team", icon: Users },
  { value: "organization", label: "Organization", icon: Building2 },
];

/** Share a resource with a person (by search or email invite), a team, or an org. */
export function ShareCollaboratorDialog({
  resourceType,
  resourceId,
  open,
  onOpenChange,
  grantedIds,
  initialMode = "user",
}: ShareCollaboratorDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<GrantRoleValue>("member");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [search, setSearch] = useState("");
  const [debounced, isDebounced] = useDebounce(search, 300);

  const onDone = () => {
    reset();
    onOpenChange(false);
  };
  const grant = useGrantResource({ onSuccess: onDone });
  const invite = useInviteResourceUser({ onSuccess: onDone });

  const { data: userSearch, isLoading: searching } = useUserSearch(debounced);
  const { data: orgs } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const teamsQuery = useQuery({
    queryKey: ["org-teams", activeOrg?.id],
    enabled: open && mode === "team" && Boolean(activeOrg?.id),
    queryFn: async () => {
      const res = await authClient.organization.getFullOrganization({
        query: { organizationId: activeOrg?.id ?? "" },
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to load teams");
      return res.data.teams;
    },
  });

  const availableUsers = useMemo(
    () => (userSearch?.body ?? []).filter((u) => !grantedIds.has(u.userId)),
    [userSearch, grantedIds],
  );
  const orgList = useMemo(
    () => (orgs ?? []).filter((o) => !grantedIds.has(o.id)),
    [orgs, grantedIds],
  );
  const teamList = useMemo(
    () => (teamsQuery.data ?? []).filter((teamItem) => !grantedIds.has(teamItem.id)),
    [teamsQuery.data, grantedIds],
  );

  const reset = () => {
    setSelectedId(null);
    setSelection(null);
    setSearch("");
    setRole("member");
    setMode(initialMode);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // Open on the requested picker (Add people vs Add teams).
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSelectedId(null);
      setSelection(null);
    }
  }, [open, initialMode]);

  const pending = grant.isPending || invite.isPending;
  const canSubmit = mode === "user" ? selection !== null : selectedId !== null;

  const submit = () => {
    if (mode === "user") {
      if (selection?.type === "user") {
        grant.mutate({
          params: { resourceType, resourceId },
          body: { granteeType: "user", granteeId: selection.user.userId, role },
        });
      } else if (selection?.type === "email") {
        invite.mutate({
          params: { resourceType, resourceId },
          body: { email: selection.email, role },
        });
      }
      return;
    }
    if (!selectedId) return;
    grant.mutate({
      params: { resourceType, resourceId },
      body: { granteeType: mode, granteeId: selectedId, role },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share access</DialogTitle>
          <DialogDescription>
            Add a person (by name or email — they don&apos;t need an account yet), a team, or an
            organization.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {MODES.map((m) => (
            <Button
              key={m.value}
              type="button"
              variant={mode === m.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode(m.value);
                setSelectedId(null);
                setSelection(null);
              }}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </Button>
          ))}
        </div>

        <div className="min-h-[160px] py-1">
          {mode === "user" && (
            <UserSearchPopover
              availableUsers={availableUsers}
              searchValue={search}
              onSearchChange={setSearch}
              isAddingUser={pending}
              loading={!isDebounced || searching}
              onSelectUser={(user) => setSelection({ type: "user", user })}
              onSelectEmail={(email) => setSelection({ type: "email", email })}
              placeholder="Search people by name or email…"
              selectedUser={selection?.type === "user" ? selection.user : null}
              selectedEmail={selection?.type === "email" ? selection.email : null}
              onClearSelection={() => setSelection(null)}
              selectedRole={role}
              onRoleChange={(r) => setRole(r as GrantRoleValue)}
            />
          )}

          {mode === "team" && (
            <PickerList
              emptyLabel={
                activeOrg ? "This organization has no teams" : "Select an organization first"
              }
              items={teamList.map((teamItem) => ({ id: teamItem.id, label: teamItem.name }))}
              selectedId={selectedId}
              onSelect={setSelectedId}
              icon={Users}
            />
          )}

          {mode === "organization" && (
            <PickerList
              emptyLabel="You are not a member of any other organization"
              items={orgList.map((o) => ({ id: o.id, label: o.name }))}
              selectedId={selectedId}
              onSelect={setSelectedId}
              icon={Building2}
            />
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          {mode === "user" ? (
            <span />
          ) : (
            <Select value={role} onValueChange={(v) => setRole(v as GrantRoleValue)}>
              <SelectTrigger className="w-[120px]" aria-label="Role to grant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit || pending}>
              Share
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PickerListProps {
  items: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
  icon: typeof Users;
}

function PickerList({ items, selectedId, onSelect, emptyLabel, icon: Icon }: PickerListProps) {
  return (
    <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
      {items.length === 0 ? (
        <li className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyLabel}</li>
      ) : (
        items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left",
                selectedId === item.id && "bg-muted",
              )}
            >
              <span className="bg-primary/10 text-primary grid h-8 w-8 shrink-0 place-items-center rounded-full">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
              {selectedId === item.id && <Check className="text-primary h-4 w-4" />}
            </button>
          </li>
        ))
      )}
    </ul>
  );
}
