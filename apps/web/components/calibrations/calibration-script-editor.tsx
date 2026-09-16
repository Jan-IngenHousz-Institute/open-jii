"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { CodeEditor } from "@/components/shared/code-editor";
import { useAutosave } from "@/hooks/useAutosave";
import { useState } from "react";

interface CalibrationScriptEditorProps {
  script: string;
  canEdit: boolean;
  onSave: (script: string) => Promise<void>;
}

/**
 * The fit, edited in place and saved as it is typed.
 *
 * No explicit save: a definition is edited a line at a time while its author works out
 * what the bench produced, and a form that must be submitted turns that into a ritual.
 * Progress is reported to the page's own indicator rather than printed here.
 */
export function CalibrationScriptEditor({ script, canEdit, onSave }: CalibrationScriptEditorProps) {
  const [draft, setDraft] = useState(script);

  const autosave = useAutosave<string>({
    value: draft,
    toKey: (value) => value,
    // An empty script would be refused by the contract, and an author passes through
    // empty while rewriting one.
    isValid: (value) => value.trim() !== "",
    save: onSave,
    enabled: canEdit,
  });

  useReportAutosaveStatus({ status: autosave.status, error: autosave.error });

  return (
    <CodeEditor
      value={draft}
      onChange={canEdit ? setDraft : undefined}
      language="python"
      readOnly={!canEdit}
      minHeight="12rem"
      maxHeight="32rem"
    />
  );
}
