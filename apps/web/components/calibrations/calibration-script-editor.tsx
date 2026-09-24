"use client";

import { CodeEditor } from "@/components/shared/code-editor";

import { useTranslation } from "@repo/i18n";

interface CalibrationScriptEditorProps {
  script: string;
  canEdit: boolean;
  onChange: (script: string) => void;
}

export function CalibrationScriptEditor({
  script,
  canEdit,
  onChange,
}: CalibrationScriptEditorProps) {
  const { t } = useTranslation("iot");

  // No height cap: a box that scrolls inside itself shows twenty lines of ninety with no
  // sign of the rest, and a reviewer reads the whole fit or none of it.
  return (
    <div className="group/script space-y-1.5">
      <div className="border-border overflow-hidden rounded-md border">
        <CodeEditor
          value={script}
          onChange={canEdit ? onChange : undefined}
          language="python"
          readOnly={!canEdit}
          minHeight="12rem"
        />
      </div>

      {/* Tab indents Python, so the way out has to be said while the editor holds focus. */}
      {canEdit && (
        <p className="text-muted-foreground hidden text-xs group-focus-within/script:block">
          {t("iot.calibration.fit.leaveEditor")}
        </p>
      )}
    </div>
  );
}
