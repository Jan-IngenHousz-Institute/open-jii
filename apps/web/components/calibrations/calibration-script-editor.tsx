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
  // The editor paints no chrome of its own, so the frame every other call site gives it
  // is what keeps it from reading as a slab dropped on the card.
  return (
    <div className="border-border overflow-hidden rounded-md border">
      <CodeEditor
        value={script}
        onChange={canEdit ? onChange : undefined}
        language="python"
        readOnly={!canEdit}
        minHeight="12rem"
        maxHeight="32rem"
      />
    </div>
  );
}
