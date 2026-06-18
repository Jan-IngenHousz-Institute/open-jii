"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authClient, useSession } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
}

const ASSIGNABLE_ROLES = ["user", "admin"] as const;

function isPlatformAdmin(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .some((r) => r === "admin");
}

/**
 * Platform admin console (Better Auth admin plugin): list users and manage their
 * global role, ban status, and impersonation. Gated on the caller's platform role.
 */
export function PlatformAdminConsole() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;
  const amAdmin = isPlatformAdmin((session?.user as { role?: string | null } | undefined)?.role);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    enabled: amAdmin,
    queryFn: async () => {
      const res = await authClient.admin.listUsers({ query: { limit: 100 } });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to load users");
      }
      return res.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const setRole = useMutation({
    mutationFn: (vars: { userId: string; role: "user" | "admin" }) =>
      authClient.admin.setRole({ userId: vars.userId, role: vars.role }),
    onSuccess: invalidate,
  });
  const ban = useMutation({
    mutationFn: (userId: string) => authClient.admin.banUser({ userId }),
    onSuccess: invalidate,
  });
  const unban = useMutation({
    mutationFn: (userId: string) => authClient.admin.unbanUser({ userId }),
    onSuccess: invalidate,
  });
  const impersonate = useMutation({
    mutationFn: (userId: string) => authClient.admin.impersonateUser({ userId }),
    onSuccess: () => router.refresh(),
  });

  if (!amAdmin) {
    return <p className="text-muted-foreground text-sm">You do not have platform admin access.</p>;
  }

  const users = (usersQuery.data?.users ?? []) as AdminUser[];

  return (
    <section aria-label="Platform admin" className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Platform users</h2>
        <p className="text-muted-foreground text-sm">Manage roles, bans, and impersonation.</p>
      </header>

      {usersQuery.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm">
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="text-muted-foreground">{u.email}</span>
                  {u.banned ? <span className="text-destructive ml-2 text-xs">banned</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <select
                    aria-label={`Role for ${u.email}`}
                    value={isPlatformAdmin(u.role) ? "admin" : "user"}
                    disabled={isSelf}
                    onChange={(e) =>
                      setRole.mutate({ userId: u.id, role: e.target.value as "user" | "admin" })
                    }
                    className="h-8 rounded-md border px-2 text-sm disabled:opacity-50"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {!isSelf && (
                    <>
                      {u.banned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unban.isPending}
                          onClick={() => unban.mutate(u.id)}
                          aria-label={`Unban ${u.email}`}
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ban.isPending}
                          onClick={() => ban.mutate(u.id)}
                          aria-label={`Ban ${u.email}`}
                        >
                          Ban
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={impersonate.isPending}
                        onClick={() => impersonate.mutate(u.id)}
                        aria-label={`Impersonate ${u.email}`}
                      >
                        Impersonate
                      </Button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
