"use client";

import { useLocale } from "@/hooks/useLocale";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

/**
 * Active-organization switcher for the topbar. Lists the organizations the user
 * belongs to and switches the session's active organization. Hidden until at
 * least one organization is available (every user has a personal org).
 */
export function OrganizationSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: organizations, isPending } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [isSwitching, setIsSwitching] = useState(false);

  const orgs = organizations ?? [];
  if (isPending || orgs.length === 0) {
    return null;
  }

  const activeName = activeOrganization?.name ?? orgs[0].name;

  const handleSelect = async (organizationId: string) => {
    if (organizationId === activeOrganization?.id) {
      return;
    }
    setIsSwitching(true);
    try {
      await authClient.organization.setActive({ organizationId });
      // Lists span all orgs now, so a hard refresh is unnecessary; a broad
      // invalidate refreshes the create-default-dependent views.
      await queryClient.invalidateQueries();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[220px] gap-2"
          disabled={isSwitching}
          aria-label="Switch organization"
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{activeName}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => void handleSelect(org.id)}
            className="gap-2"
          >
            <span className="truncate">{org.name}</span>
            {org.id === activeOrganization?.id && <Check className="ml-auto h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onClick={() => router.push(`/${locale}/platform/organizations`)}
        >
          <Search className="h-4 w-4 shrink-0" />
          Browse organizations
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onClick={() => router.push(`/${locale}/platform/organizations/new`)}
        >
          <Plus className="h-4 w-4 shrink-0" />
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
