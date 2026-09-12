"use client";

import { ErrorDisplay } from "@/components/error-display";
import type { AccessDeniedResource } from "@/components/shared/resource-access-denied";
import { ResourceAccessDenied } from "@/components/shared/resource-access-denied";
import { httpStatusOf } from "@/util/apiError";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";

interface EntityLayoutShellProps {
  isLoading: boolean;
  error: unknown;
  hasData: boolean;
  /** Names the resource in the denied page, and where that page sends the viewer back to. */
  resource: AccessDeniedResource;
  loadingMessage?: string;
  errorDescription?: string;
  /** Passed through to the denied page for resources that accept access requests. */
  requestAccess?: ReactNode;
  children: ReactNode;
}

export function EntityLayoutShell({
  isLoading,
  error,
  hasData,
  resource,
  loadingMessage,
  errorDescription,
  requestAccess,
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
    const status = httpStatusOf(error);
    if (status === 404 || status === 400) {
      notFound();
    }

    if (status === 403) {
      return <ResourceAccessDenied resource={resource} requestAccess={requestAccess} />;
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
