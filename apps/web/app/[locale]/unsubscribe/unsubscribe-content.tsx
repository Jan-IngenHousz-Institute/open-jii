"use client";

import { useResubscribeEmailByToken } from "@/hooks/notifications/useResubscribeEmailByToken/useResubscribeEmailByToken";
import { useUnsubscribeEmailByToken } from "@/hooks/notifications/useUnsubscribeEmailByToken/useUnsubscribeEmailByToken";
import { getOrpcError } from "@/lib/orpc";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

import { UnsubscribeCard } from "./unsubscribe-card";

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
  useEffect(() => unsubscribeByToken({ token }), [token, unsubscribeByToken]);

  // Once Undo is pressed, the card reports on it rather than on the unsubscribe.
  const latest = resubscribe.isIdle ? unsubscribe : resubscribe;
  const isLinkRefused = getOrpcError(latest.error)?.status === 400;
  const isUnsubscribed = unsubscribe.isSuccess && resubscribe.isIdle;

  const settingsPath = `/${locale}/platform/account/notifications`;
  const signInPath = `/${locale}/login?callbackUrl=${encodeURIComponent(settingsPath)}`;
  const categoryLabel = (category: string) => t(`categories.${category}.label`);

  const handleUndo = () => resubscribe.mutate({ token });
  const handleRetry = () => latest.mutate({ token });

  const settingsLink = (
    <Button asChild>
      <Link href={settingsPath}>{t("unsubscribe.settings")}</Link>
    </Button>
  );

  if (isLinkRefused) {
    return (
      <UnsubscribeCard
        heading={t("unsubscribe.invalid.heading")}
        body={t("unsubscribe.invalid.body")}
      >
        <Button asChild>
          <Link href={signInPath}>{t("unsubscribe.signIn")}</Link>
        </Button>
      </UnsubscribeCard>
    );
  }

  if (latest.isError) {
    return (
      <UnsubscribeCard body={t("unsubscribe.error.body")}>
        <Button onClick={handleRetry}>{t("unsubscribe.retry")}</Button>
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

  if (isUnsubscribed) {
    return (
      <UnsubscribeCard
        heading={t("unsubscribe.done.heading")}
        body={t("unsubscribe.done.body", { category: categoryLabel(unsubscribe.data.category) })}
      >
        <Button variant="outline" onClick={handleUndo}>
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
