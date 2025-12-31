"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from "@repo/ui/components";

import type { ConsentStatus } from "../lib/cookie-consent";
import { getConsentStatus, setConsentStatus } from "../lib/cookie-consent";

export function CookieBanner() {
  const posthog = usePostHog();
  const [consentGiven, setConsentGiven] = useState<ConsentStatus | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setConsentGiven(getConsentStatus());
  }, []);

  const handleAcceptCookies = () => {
    setConsentStatus("accepted");
    setConsentGiven("accepted");
    posthog.opt_in_capturing();
  };

  const handleDeclineCookies = () => {
    setConsentStatus("rejected");
    setConsentGiven("rejected");
    posthog.opt_out_capturing();
    posthog.reset();
  };

  const handleSavePreferences = () => {
    if (analyticsEnabled) {
      setConsentStatus("accepted");
      setConsentGiven("accepted");
      posthog.opt_in_capturing();
    } else {
      setConsentStatus("rejected");
      setConsentGiven("rejected");
      posthog.opt_out_capturing();
      posthog.reset();
    }
    setShowManage(false);
  };

  if (consentGiven === null || consentGiven !== "pending") {
    return null;
  }

  return (
    <>
      <div className="bg-card border-border fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.1)]">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm sm:pr-6">
              {t("cookieBanner.intro")}
              <Link href="/cookie-policy" className="text-primary hover:underline" prefetch={false}>
                {t("cookieBanner.cookiePolicy")}
              </Link>
            </p>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={() => setShowManage(true)}>
                {t("cookieBanner.managePreferences")}
              </Button>
              <Button variant="secondary" onClick={handleDeclineCookies}>
                {t("cookieBanner.rejectAll")}
              </Button>
              <Button onClick={handleAcceptCookies}>{t("cookieBanner.acceptAll")}</Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cookieBanner.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("cookieBanner.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-border flex items-center justify-between rounded-md border p-4">
              <div className="flex-1">
                <h4 className="text-foreground font-medium">{t("cookieBanner.essentialTitle")}</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("cookieBanner.essentialDescription")}
                </p>
              </div>
              <div className="text-muted-foreground ml-4 text-sm font-medium">
                {t("cookieBanner.essentialAlways")}
              </div>
            </div>

            <div className="border-border flex items-center justify-between rounded-md border p-4">
              <div className="flex-1">
                <h4 className="text-foreground font-medium">{t("cookieBanner.analyticsTitle")}</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("cookieBanner.analyticsDescription")}
                </p>
              </div>
              <Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsEnabled} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSavePreferences}>{t("cookieBanner.saveClose")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
