"use client";

import React from "react";

import { useTranslation } from "@repo/i18n";

import { useMacro } from "../../hooks/macro/useMacro/useMacro";
import { MacroDetailsCard } from "./macro-details-card";
import { MacroInfoCard } from "./macro-info-card";

interface MacroSettingsProps {
  macroId: string;
}

export function MacroSettings({ macroId }: MacroSettingsProps) {
  const { data, isLoading } = useMacro(macroId);
  const { t } = useTranslation("macro");

  if (isLoading) {
    return <div>{t("macroSettings.loading")}</div>;
  }

  if (!data) {
    return <div>{t("macroSettings.notFound")}</div>;
  }

  const macro = data;

  return (
    <div className="space-y-6">
      {/* Edit Macro Details Card - First */}
      <MacroDetailsCard
        macroId={macroId}
        initialName={macro.name}
        initialDescription={macro.description ?? ""}
        initialLanguage={macro.language}
        initialCode={macro.code}
      />

      {/* Macro Info Card - Last */}
      <MacroInfoCard macroId={macroId} macro={macro} />
    </div>
  );
}
