"use client";

import { usePublicOrganizations } from "@/hooks/organization/usePublicOrganizations";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { Building2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";

import { OrganizationCard } from "./organization-card";

/** Public organization directory: search + request-to-join. */
export function OrganizationDirectory() {
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [debounced] = useDebounce(search, 300);
  const { data, isPending } = usePublicOrganizations(debounced.trim() || undefined);
  const organizations = data?.body ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-muted-foreground text-sm">
            Discover public labs and groups, see what they are working on, and request to join.
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/platform/organizations/new`}>
            <Plus className="h-4 w-4" />
            Create organization
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations…"
          aria-label="Search organizations"
          className="pl-9"
        />
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <div className="rounded-lg border px-6 py-16 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
            <Building2 className="h-5 w-5" />
          </div>
          <p className="text-foreground text-sm font-semibold">No organizations found</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {search ? "Try a different search." : "Be the first to create a public organization."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} organization={org} />
          ))}
        </div>
      )}
    </div>
  );
}
