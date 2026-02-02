"use client";

import { useLocale } from "@/hooks/useLocale";
import { ArchiveIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components";

interface ExperimentArchivedRedirectProps {
  experimentId: string;
}

const REDIRECT_DELAY_SECONDS = 5;

export function ExperimentArchivedRedirect({ experimentId }: ExperimentArchivedRedirectProps) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(REDIRECT_DELAY_SECONDS);

  const archiveUrl = `/${locale}/platform/experiments-archive/${experimentId}`;

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push(archiveUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [archiveUrl, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <ArchiveIcon className="text-muted-foreground h-6 w-6" />
          </div>
          <CardTitle>{t("archivedRedirect.title")}</CardTitle>
          <CardDescription>{t("archivedRedirect.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {t("archivedRedirect.redirectingIn", { seconds: secondsRemaining })}
          </p>
          <Link href={archiveUrl} className="text-primary underline-offset-4 hover:underline">
            {t("archivedRedirect.goToArchive")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
