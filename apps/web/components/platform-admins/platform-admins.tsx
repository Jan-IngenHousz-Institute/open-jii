"use client";

import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { useLocale } from "@/hooks/useLocale";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";

export function PlatformAdmins() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { userId } = usePrincipal();
  const access = usePlatformAdmin();
  const allowed = access.data?.isPlatformAdmin === true;
  const admins = useQuery({
    ...orpc.users.listPlatformAdmins.queryOptions({ input: {} }),
    queryKey: withPrincipal(orpc.users.listPlatformAdmins.queryKey({ input: {} }), userId),
    enabled: allowed,
  });

  useEffect(() => {
    if (access.data && !allowed) router.replace(`/${locale}/platform`);
  }, [access.data, allowed, locale, router]);

  if (access.isError) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">{t("platformAdmins.title")}</h1>
        <div role="alert">
          <p>{t("platformAdmins.loadFailed")}</p>
          <Button variant="outline" onClick={() => void access.refetch()}>
            {t("platformAdmins.retry")}
          </Button>
        </div>
      </div>
    );
  }
  if (!allowed) return <p role="status">{t("common.loading")}</p>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("platformAdmins.title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("platformAdmins.description")}</p>
        <p className="text-muted-foreground mt-2 text-sm">{t("platformAdmins.howGranted")}</p>
      </div>
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
        <ul className="space-y-3">
          {admins.data?.map((person) => (
            <li key={person.id} className="min-w-0 space-y-1 border-b pb-3 last:border-0">
              <p className="break-words font-medium">{person.name}</p>
              <p className="text-muted-foreground text-sm">
                {person.grantedAt === null
                  ? t("platformAdmins.dateUnknown")
                  : t("platformAdmins.since", {
                      date: new Date(person.grantedAt).toLocaleDateString(locale),
                    })}
              </p>
              <p className="text-muted-foreground break-all font-mono text-xs">
                <span className="sr-only">{t("platformAdmins.userId")} </span>
                {person.id}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
