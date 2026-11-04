"use client";

import { useResubscribeEmailByToken } from "@/hooks/notifications/useResubscribeEmailByToken/useResubscribeEmailByToken";
import { useUnsubscribeEmailByToken } from "@/hooks/notifications/useUnsubscribeEmailByToken/useUnsubscribeEmailByToken";
import { getOrpcError } from "@/lib/orpc";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

interface UnsubscribeContentProps {
  token: string;
  locale: string;
}

export function UnsubscribeContent({ token, locale }: UnsubscribeContentProps) {
  const { t } = useTranslation("notifications");
  const unsubscribe = useUnsubscribeEmailByToken();
  const resubscribe = useResubscribeEmailByToken();
  const { mutate: unsubscribeByToken } = unsubscribe;

  // The GET that opened this page may be a mail scanner's; only this POST changes anything.
  // Deferred past React's development remount, which detaches the observer of a mutation
  // started before it and would leave the card waiting forever.
  useEffect(() => {
    const timer = setTimeout(() => unsubscribeByToken({ token }), 0);
    return () => clearTimeout(timer);
  }, [token, unsubscribeByToken]);

  const settingsPath = `/${locale}/platform/account/notifications`;
  const settingsLink = (
    <Button asChild>
      <Link href={settingsPath}>{t("unsubscribe.settings")}</Link>
    </Button>
  );
  const latest = resubscribe.isIdle ? unsubscribe : resubscribe;
  const categoryLabel = (category: string) => t(`categories.${category}.label`);

  if (latest.isError) {
    if (getOrpcError(latest.error)?.status === 400) {
      return (
        <UnsubscribeCard
          heading={t("unsubscribe.invalid.heading")}
          body={t("unsubscribe.invalid.body")}
        >
          <Button asChild>
            <Link href={`/${locale}/login?callbackUrl=${encodeURIComponent(settingsPath)}`}>
              {t("unsubscribe.signIn")}
            </Link>
          </Button>
        </UnsubscribeCard>
      );
    }

    return (
      <UnsubscribeCard body={t("unsubscribe.error.body")}>
        <Button onClick={() => latest.mutate({ token })}>{t("unsubscribe.retry")}</Button>
      </UnsubscribeCard>
    );
  }

  if (resubscribe.isSuccess) {
    return (
      <UnsubscribeCard
        heading={t("unsubscribe.undone.heading")}
        body={t("unsubscribe.undone.body", { category: categoryLabel(resubscribe.data.category) })}
      >
        {settingsLink}
      </UnsubscribeCard>
    );
  }

  if (unsubscribe.isSuccess && resubscribe.isIdle) {
    return (
      <UnsubscribeCard
        heading={t("unsubscribe.done.heading")}
        body={t("unsubscribe.done.body", { category: categoryLabel(unsubscribe.data.category) })}
      >
        <Button variant="outline" onClick={() => resubscribe.mutate({ token })}>
          {t("unsubscribe.undo")}
        </Button>
        {settingsLink}
      </UnsubscribeCard>
    );
  }

  return (
    <Card>
      <CardContent
        role="status"
        className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t("unsubscribe.working")}
      </CardContent>
    </Card>
  );
}

function UnsubscribeCard({
  heading,
  body,
  children,
}: {
  heading?: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="bg-muted text-muted-foreground grid h-12 w-12 place-items-center rounded-full">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        {heading && <h1 className="text-xl font-semibold">{heading}</h1>}
        <p className="text-muted-foreground text-sm">{body}</p>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </CardContent>
    </Card>
  );
}
