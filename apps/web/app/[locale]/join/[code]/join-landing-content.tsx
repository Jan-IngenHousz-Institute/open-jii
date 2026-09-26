"use client";

import Image from "next/image";

import { formatJoinCode } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.openjii.app";

interface JoinLandingContentProps {
  /** Already normalized by the route's schema. */
  code: string;
}

export function JoinLandingContent({ code }: JoinLandingContentProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 text-center">
        <Image
          src="/openJII_logo_RGB_horizontal_green_yellow_trimmed.svg"
          alt={t("common.logo")}
          width={170}
          height={50}
          className="h-8 w-auto dark:hidden"
        />
        <Image
          src="/openJII_logo_RGB_horizontal_yellow_transparentBG.png"
          alt={t("common.logo")}
          width={170}
          height={50}
          className="hidden h-8 w-auto dark:block"
        />

        <h1 className="text-xl font-semibold">{t("joinLanding.heading")}</h1>

        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{t("joinLanding.codeLabel")}</p>
          <p className="font-mono text-3xl tracking-widest">{formatJoinCode(code)}</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button asChild>
            <a href={`openjii://join/${code}`}>{t("joinLanding.openApp")}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
              {t("joinLanding.getApp")}
            </a>
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">{t("joinLanding.haveApp")}</p>
      </CardContent>
    </Card>
  );
}
