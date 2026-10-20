"use client";

import { useLocale } from "~/hooks/useLocale";

import type { StandardReadiness } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

interface NotApplicableLineProps {
  standards: StandardReadiness[];
}

/** The destinations that do not fit this trial, folded into one line with the reason behind it. */
export function NotApplicableLine({ standards }: NotApplicableLineProps) {
  const { t } = useTranslation("readinessConceptB");
  const { t: tStandards } = useTranslation("standards");
  const locale = useLocale();

  const names = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    standards.map((row) => tStandards(`destination.${row.standard}`)),
  );

  const renderReason = (row: StandardReadiness) => (
    <li key={row.standard}>{t(`why.${row.reason.code}`, { ...row.reason })}</li>
  );

  return (
    <Card padding="none" className="shadow-none">
      <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-muted-foreground text-sm">{t("notApplicable", { names })}</p>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="link" className="h-auto shrink-0 p-0 text-sm">
              {t("why.trigger")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 text-sm">
            <ul className="space-y-2">{standards.map(renderReason)}</ul>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
