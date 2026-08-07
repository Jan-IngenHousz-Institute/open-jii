"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { env } from "~/env";

import { useTranslation } from "@repo/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

const GUIDE_STEP_KEYS = [
  "iot.onboarding.guide.step1",
  "iot.onboarding.guide.step2",
  "iot.onboarding.guide.step3",
  "iot.onboarding.guide.step4",
  "iot.onboarding.guide.step5",
  "iot.onboarding.guide.step6",
] as const;

export function DeviceOnboardingGuide() {
  const { t } = useTranslation("iot");

  const renderStep = (key: (typeof GUIDE_STEP_KEYS)[number]) => (
    <li key={key} className="text-muted-foreground text-sm">
      {t(key)}
    </li>
  );

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold">
        <BookOpen className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{t("iot.onboarding.guide.title")}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-4 pb-4">
        <ol className="list-decimal space-y-1.5 pl-5">{GUIDE_STEP_KEYS.map(renderStep)}</ol>
        <a
          href={`${env.NEXT_PUBLIC_DOCS_URL}/developers/device-integration`}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm underline underline-offset-2"
        >
          {t("iot.onboarding.guide.docsLink")}
        </a>
      </CollapsibleContent>
    </Collapsible>
  );
}
