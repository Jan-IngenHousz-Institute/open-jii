"use client";

import { CodeEditor } from "@/components/shared/code-editor";

interface CalibrationScriptEditorProps {
  script: string;
  canEdit: boolean;
  onChange: (script: string) => void;
}

/**
 * The fit, edited in place and saved with the rest of the definition.
 *
 * No explicit save: a definition is edited a line at a time while its author works out
 * what the bench produced, and a form that must be submitted turns that into a ritual.
 */
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
