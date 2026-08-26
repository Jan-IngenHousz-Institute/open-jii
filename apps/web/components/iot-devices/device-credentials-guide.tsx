"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { KeyRound } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

const STEP_KEYS = ["step1", "step2", "step3", "step4"] as const;

/**
 * The credentials tab's companion rail: what a certificate is in this
 * platform's lifecycle and how the show-once rule works, so the action card
 * never has to explain itself mid-action.
 */
export function DeviceCredentialsGuide() {
  const { t } = useTranslation("iot");

  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <KeyRound className="text-muted-foreground size-4" aria-hidden />
        <CardTitle className="text-base">{t("iot.devices.credentials.guide.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="text-muted-foreground list-decimal space-y-2 pl-4 text-sm">
          {STEP_KEYS.map((step) => (
            <li key={step}>{t(`iot.devices.credentials.guide.${step}`)}</li>
          ))}
        </ol>
        <DocsHelpLink path="/developers/device-integration" />
      </CardContent>
    </Card>
  );
}
