"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

interface ErrorContentProps {
  locale: string;
  error?: string;
  errorDescription?: string;
}

export function ErrorContent({ locale, error, errorDescription }: ErrorContentProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-card text-card-foreground ring-border flex min-h-[600px] w-full flex-col rounded-2xl p-8 shadow-lg ring-1 md:p-14">
      {/* Spacer to center content vertically */}
      <div className="flex-1" />

      <div className="flex flex-col items-center">
        {/* Error Icon */}
        <div className="mb-6 flex items-center justify-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-3 text-center text-3xl font-bold">{t("auth.errorTitle")}</h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8 text-center text-sm">
          {errorDescription ?? t("auth.errorDescription")}
        </p>

        {/* Error Code (if available) */}
        {error && (
          <p className="text-muted-foreground mb-6 text-center font-mono text-xs">Error: {error}</p>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          <Button asChild className="h-12 w-full rounded-full" size="lg">
            <Link href={`/${locale}/login`}>{t("auth.errorTryAgain")}</Link>
          </Button>

          <Button asChild variant="outline" className="h-12 w-full rounded-full" size="lg">
            <Link href={`/${locale}`}>{t("auth.errorGoHome")}</Link>
          </Button>
        </div>

        {/* Support Message */}
        <p className="text-accent-foreground mt-6 text-center text-xs">{t("auth.errorSupport")}</p>
      </div>

      {/* Spacer to center content vertically */}
      <div className="flex-1" />
    </div>
  );
}
