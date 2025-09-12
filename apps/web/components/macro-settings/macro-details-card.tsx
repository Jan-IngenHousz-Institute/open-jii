"use client";

import React from "react";

import type { MacroLanguage } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";

interface MacroDetailsCardProps {
  macroId: string;
  initialName: string;
  initialDescription: string;
  initialLanguage: MacroLanguage;
}

export function MacroDetailsCard({
  macroId: _macroId,
  initialName,
  initialDescription,
  initialLanguage,
}: MacroDetailsCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("macroSettings.generalSettings")}</CardTitle>
        <CardDescription>{t("macroSettings.generalDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>{t("macros.editDetailsComingSoon")}</p>
          <div className="mt-4 space-y-2">
            <p>
              <strong>{t("common.name")}:</strong> {initialName}
            </p>
            <p>
              <strong>{t("common.description")}:</strong> {initialDescription || t("common.none")}
            </p>
            <p>
              <strong>{t("common.language")}:</strong> {initialLanguage}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
