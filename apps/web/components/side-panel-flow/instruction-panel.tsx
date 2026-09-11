import { SettingsCard } from "@/components/shared/settings-card";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { RichTextarea } from "@repo/ui/components/rich-textarea";

interface InstructionPanelProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}
export function InstructionPanel({ value, onChange, disabled = false }: InstructionPanelProps) {
  const { t } = useTranslation("experiments");
  return (
    <SettingsCard title={t("instructionPanel.title")}>
      <RichTextarea
        value={value}
        onChange={onChange}
        placeholder={t("instructionPanel.placeholder")}
        isDisabled={disabled}
      />
    </SettingsCard>
  );
}
