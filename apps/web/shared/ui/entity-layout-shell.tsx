"use client";

import { ErrorDisplay } from "@/components/error-display";
import { notFound } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface EntityLayoutShellProps {
  isLoading: boolean;
  error: unknown;
  hasData: boolean;
  loadingMessage?: string;
  errorDescription?: string;
  children: React.ReactNode;
}

export function EntityLayoutShell({
  isLoading,
  error,
  hasData,
  loadingMessage,
  errorDescription,
  children,
}: EntityLayoutShellProps) {
  const { t } = useTranslation("common");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">{loadingMessage ?? t("common.loading")}</div>
      </div>
    );
  }

  if (error) {
    const errorObj = error as { status?: number };
    if (errorObj.status === 404 || errorObj.status === 400) {
      notFound();
    }
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{t("errors.error")}</h3>
          <p className="text-muted-foreground text-sm">
            {errorDescription ?? t("errors.resourceNotFoundMessage")}
          </p>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!hasData) {
    return null;
  }

  return <>{children}</>;
}
