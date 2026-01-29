"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { use } from "react";
import * as React from "react";

import { useTranslation } from "@repo/i18n/client";

interface DataLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string; locale: string }>;
}

export default function DataLayout({ children, params }: DataLayoutProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");

  // Provisioning state checks removed - with centrum consolidation, all experiments
  // use the single centrum schema without per-experiment provisioning
  const experiment = data?.body;

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!data || !experiment) {
    return <div>{t("notFound")}</div>;
  }

  return <>{children}</>;
}
