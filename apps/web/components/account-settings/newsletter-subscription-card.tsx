"use client";

import { useNewsletterStatus } from "@/hooks/newsletter/useNewsletterStatus/useNewsletterStatus";
import { useSubscribeNewsletter } from "@/hooks/newsletter/useSubscribeNewsletter/useSubscribeNewsletter";
import { useUnsubscribeNewsletter } from "@/hooks/newsletter/useUnsubscribeNewsletter/useUnsubscribeNewsletter";
import { parseApiError } from "@/util/apiError";
import { AlertCircle, Loader2, Mail } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Switch } from "@repo/ui/components/switch";

export function NewsletterSubscriptionCard() {
  const { t } = useTranslation("account");
  const statusQuery = useNewsletterStatus();
  const subscribe = useSubscribeNewsletter();
  const unsubscribe = useUnsubscribeNewsletter();
  const isUpdating = subscribe.isPending || unsubscribe.isPending;
  const mutationFailed = subscribe.isError || unsubscribe.isError;
  // The forgotten-email case can only arise on the subscribe path (Mailchimp
  // suppresses a permanently deleted address); unsubscribe never hits it.
  const isForgottenEmail = parseApiError(subscribe.error)?.code === "MAILCHIMP_FORGOTTEN_EMAIL";

  const handleCheckedChange = (checked: boolean) => {
    subscribe.reset();
    unsubscribe.reset();

    if (checked) {
      subscribe.mutate(undefined);
    } else {
      unsubscribe.mutate(undefined);
    }
  };

  const renderContent = () => {
    if (statusQuery.isLoading) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("settings.NewsletterSubscriptionCard.loading")}
        </div>
      );
    }

    if (statusQuery.isError || !statusQuery.data) {
      return (
        <div className="border-destructive/30 bg-destructive/5 rounded-md border p-4">
          <div className="text-destructive flex items-start gap-2 text-sm" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("settings.NewsletterSubscriptionCard.error")}</span>
          </div>
          <Button
            className="mt-3"
            type="button"
            variant="outline"
            size="sm"
            disabled={statusQuery.isFetching}
            onClick={() => void statusQuery.refetch()}
          >
            {statusQuery.isFetching
              ? t("settings.NewsletterSubscriptionCard.retrying")
              : t("settings.NewsletterSubscriptionCard.retry")}
          </Button>
        </div>
      );
    }

    const { status } = statusQuery.data;
    const isSubscribed = status === "subscribed";
    const isPendingConfirmation = status === "pending";
    const descriptionKey = isSubscribed
      ? "settings.NewsletterSubscriptionCard.subscribed"
      : isPendingConfirmation
        ? "settings.NewsletterSubscriptionCard.pending"
        : "settings.NewsletterSubscriptionCard.unsubscribed";

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {t("settings.NewsletterSubscriptionCard.toggleLabel")}
            </div>
            <p
              className={
                isPendingConfirmation ? "text-primary text-sm" : "text-muted-foreground text-sm"
              }
              role={isPendingConfirmation ? "status" : undefined}
            >
              {t(descriptionKey)}
            </p>
          </div>
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleCheckedChange}
            disabled={isUpdating}
            aria-label={t("settings.NewsletterSubscriptionCard.toggleLabel")}
          />
        </div>

        {mutationFailed && (
          <p className="text-destructive text-sm" role="alert">
            {t(
              isForgottenEmail
                ? "settings.NewsletterSubscriptionCard.forgottenEmailError"
                : "settings.NewsletterSubscriptionCard.updateError",
            )}
          </p>
        )}
        {isUpdating && (
          <p className="text-muted-foreground text-sm" role="status">
            {t("settings.NewsletterSubscriptionCard.updating")}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card className="rounded-md shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Mail className="text-primary h-5 w-5" aria-hidden />
          <CardTitle>{t("settings.NewsletterSubscriptionCard.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.NewsletterSubscriptionCard.description")}</CardDescription>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}
