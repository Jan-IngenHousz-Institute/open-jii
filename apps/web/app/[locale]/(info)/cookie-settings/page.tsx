"use client";

import { usePostHog } from "posthog-js/react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import type { ConsentStatus } from "../../../../lib/cookie-consent";
import { getConsentStatus, setConsentStatus } from "../../../../lib/cookie-consent";

/**
 * Cookie settings page component
 * Allows users to manage their cookie preferences at any time
 */
export default function CookieSettingsPage() {
  const posthog = usePostHog();
  const { t } = useTranslation();
  const [consentGiven, setConsentGiven] = useState<ConsentStatus>(getConsentStatus);

  const isAccepted = consentGiven === "accepted";

  const handleToggleAnalytics = () => {
    if (isAccepted) {
      posthog.opt_out_capturing();
      posthog.reset();
      setConsentStatus("rejected");
      setConsentGiven("rejected");
      toast({ description: t("cookieSettings.analyticsDisabledToast") });
    } else {
      posthog.opt_in_capturing();
      setConsentStatus("accepted");
      setConsentGiven("accepted");
      toast({ description: t("cookieSettings.analyticsEnabledToast") });
    }
  };

  return (
    <div className="from-jii-bright-green/40 relative isolate min-h-screen overflow-hidden bg-gradient-to-br via-white to-white">
      {/* Background skew block */}
      <div
        aria-hidden="true"
        className="shadow-primary/10 ring-jii-bright-green/20 absolute inset-y-0 right-1/2 -z-10 -mr-96 w-[200%] origin-top-right skew-x-[-30deg] bg-white shadow-xl ring-1 sm:-mr-80 lg:-mr-96"
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto">
          {t("cookieSettings.title")}
        </h1>

        <p className="text-muted-foreground mt-4">{t("cookieSettings.intro")}</p>

        <div className="mt-16 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{t("cookieSettings.essentialTitle")}</CardTitle>
              <CardDescription>{t("cookieSettings.essentialDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{t("cookieSettings.essentialPurpose")}</strong>{" "}
                  {t("cookieSettings.essentialPurposeText")}
                </p>
                <p className="text-sm">
                  <strong>{t("cookieSettings.essentialExamples")}</strong>{" "}
                  {t("cookieSettings.essentialExamplesText")}
                </p>
                <div className="bg-muted mt-4 rounded-md p-3">
                  <p className="text-sm font-medium">{t("cookieSettings.essentialStatus")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cookieSettings.analyticsTitle")}</CardTitle>
              <CardDescription>{t("cookieSettings.analyticsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>{t("cookieSettings.analyticsPurposeLabel")}</strong>{" "}
                    {t("cookieSettings.analyticsPurposeText")}
                  </p>
                  <p className="text-sm">
                    <strong>{t("cookieSettings.analyticsProviderLabel")}</strong>{" "}
                    {t("cookieSettings.analyticsProviderText")}
                  </p>
                  <p className="text-sm">
                    <strong>{t("cookieSettings.analyticsDataLabel")}</strong>{" "}
                    {t("cookieSettings.analyticsDataText")}
                  </p>
                </div>

                <div className="bg-muted rounded-md p-3">
                  <p className="text-sm font-medium">
                    {t("cookieSettings.currentStatus")}{" "}
                    <span
                      className={
                        consentGiven === "accepted"
                          ? "text-green-600"
                          : consentGiven === "rejected"
                            ? "text-red-600"
                            : "text-yellow-600"
                      }
                    >
                      {consentGiven === "accepted"
                        ? t("cookieSettings.statusEnabled")
                        : consentGiven === "rejected"
                          ? t("cookieSettings.statusDisabled")
                          : t("cookieSettings.statusNotSet")}
                    </span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleToggleAnalytics}>
                    {isAccepted
                      ? t("cookieSettings.disableAnalytics")
                      : t("cookieSettings.enableAnalytics")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
