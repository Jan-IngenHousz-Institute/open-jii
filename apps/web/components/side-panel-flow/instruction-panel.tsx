import React from "react";

import { useTranslation } from "@repo/i18n";
import { RichTextarea } from "@repo/ui/components";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

interface InstructionPanelProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}
export function InstructionPanel({ value, onChange, disabled = false }: InstructionPanelProps) {
  const { t } = useTranslation("experiments");
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-jii-dark-green">{t("instructionPanel.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <RichTextarea
          value={value}
          onChange={onChange}
          placeholder={t("instructionPanel.placeholder")}
          isDisabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
