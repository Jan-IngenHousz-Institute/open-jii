"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { use, useMemo } from "react";
import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

const iconVariants = cva("h-4 w-4", {
  variants: {
    status: {
      provisioning: "animate-spin",
      provisioning_failed: "",
      active: "",
      stale: "",
      archived: "",
      published: "",
    },
  },
});

interface DataLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string; locale: string }>;
}

export default function DataLayout({ children, params }: DataLayoutProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");

  // Memoize experiment status checks and message - must be called before any early returns
  const experiment = data?.body;

  const isProvisioningState = useMemo(
    () => experiment?.status === "provisioning" || experiment?.status === "provisioning_failed",
    [experiment?.status],
  );

  const message = useMemo(() => {
    if (!experiment) return null;

    if (experiment.status === "provisioning") {
      return {
        title: t("experimentData.provisioning.title"),
        description: t("experimentData.provisioning.description"),
        icon: Loader2,
        variant: "default" as const,
        tooltipText: t("experimentData.provisioning.tooltip"),
      };
    }

    if (experiment.status === "provisioning_failed") {
      return {
        title: t("experimentData.provisioningFailed.title"),
        description: t("experimentData.provisioningFailed.description"),
        icon: AlertTriangle,
        variant: "destructive" as const,
        tooltipText: t("experimentData.provisioningFailed.tooltip"),
      };
    }

    return null;
  }, [experiment, t]);

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!data || !experiment) {
    return <div>{t("notFound")}</div>;
  }

  if (!isProvisioningState || !message) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
          <p className="text-muted-foreground text-sm">{t("experimentData.description")}</p>
        </div>
      </div>

      <Alert variant={message.variant}>
        <message.icon className={iconVariants({ status: experiment.status })} />
        <AlertTitle>{message.title}</AlertTitle>
        <AlertDescription>
          {message.description}
          {experiment.status === "provisioning" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="ml-2 inline h-4 w-4 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("experimentData.provisioning.tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
