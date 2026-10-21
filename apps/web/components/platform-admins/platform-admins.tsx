"use client";

import { usePrincipal } from "@/components/auth/principal-context";
import { useLocale } from "@/hooks/useLocale";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

export function PlatformAdmins() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { userId } = usePrincipal();
  const access = usePlatformAdmin();
  const allowed = access.data?.isPlatformAdmin === true;
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const admins = useQuery({
    ...orpc.users.listPlatformAdmins.queryOptions({ input: {} }),
    queryKey: ["platform-admins", userId],
    enabled: allowed,
  });
  const candidates = useQuery({
    ...orpc.users.searchPlatformAdminCandidates.queryOptions({ input: { search: search.trim() } }),
    queryKey: ["platform-admin-candidates", userId, search.trim()],
    enabled: allowed && search.trim().length >= 2,
  });

  const eligibleCandidates = candidates.data?.filter(
    (candidate) => !admins.data?.some((person) => person.id === candidate.id),
  );

  useEffect(() => {
    if (access.data && !allowed) router.replace(`/${locale}/platform`);
  }, [access.data, allowed, locale, router]);

  async function setRole(id: string, role: "admin" | "user") {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.admin.setRole({ userId: id, role });
      if (result.error) throw new Error(result.error.message);
      await admins.refetch();
      setSearch("");
      setNotice(t(role === "admin" ? "platformAdmins.appointed" : "platformAdmins.removed"));
    } catch {
      setError(t("platformAdmins.changeFailed"));
    } finally {
      setPending(false);
    }
  }

  if (access.isError) return <p role="alert">{t("platformAdmins.loadFailed")}</p>;
  if (!allowed) return <p role="status">{t("common.loading")}</p>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("platformAdmins.title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("platformAdmins.description")}</p>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">{t("platformAdmins.current")}</h2>
        {admins.isPending && <p role="status">{t("common.loading")}</p>}
        {admins.isError && (
          <div role="alert">
            <p>{t("platformAdmins.loadFailed")}</p>
            <Button variant="outline" onClick={() => void admins.refetch()}>
              {t("platformAdmins.retry")}
            </Button>
          </div>
        )}
        {admins.data?.map((person) => (
          <div
            key={person.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
          >
            <div className="min-w-0 space-y-1">
              <p className="break-words font-medium">{person.name}</p>
              {person.configured ? (
                <Badge variant="secondary">{t("platformAdmins.configured")}</Badge>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {person.appointedAt
                    ? new Date(person.appointedAt).toLocaleDateString(locale)
                    : t("platformAdmins.dateUnknown")}
                </p>
              )}
            </div>
            {!person.configured && person.id !== userId && (
              <Button
                variant="outline"
                aria-label={t("platformAdmins.removeNamed", { name: person.name })}
                disabled={pending}
                onClick={() => void setRole(person.id, "user")}
              >
                {t("platformAdmins.remove")}
              </Button>
            )}
          </div>
        ))}
      </Card>
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">{t("platformAdmins.appoint")}</h2>
        <Label htmlFor="admin-researcher-search">{t("platformAdmins.search")}</Label>
        <Input
          id="admin-researcher-search"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search.trim().length >= 2 && candidates.isPending && (
          <p role="status">{t("common.loading")}</p>
        )}
        {candidates.isError && <p role="alert">{t("platformAdmins.searchFailed")}</p>}
        {search.trim().length >= 2 && candidates.data?.length === 0 && (
          <p>{t("platformAdmins.noResults")}</p>
        )}
        {search.trim().length >= 2 &&
          candidates.data &&
          candidates.data.length > 0 &&
          eligibleCandidates?.length === 0 && <p>{t("platformAdmins.alreadyAdmin")}</p>}
        {eligibleCandidates?.map((candidate) => (
          <div key={candidate.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{candidate.name}</span>
            <Button disabled={pending} onClick={() => void setRole(candidate.id, "admin")}>
              {t("platformAdmins.appoint")}
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
