"use client";

import { CodeEditor } from "@/components/shared/code-editor";

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
  return (
    <CodeEditor
      value={script}
      onChange={canEdit ? onChange : undefined}
      language="python"
      readOnly={!canEdit}
      minHeight="12rem"
      maxHeight="32rem"
    />
  );
}
