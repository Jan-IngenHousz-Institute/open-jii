"use client";

import CommandCodeEditor from "@/components/command-code-editor";
import { JsonCodeViewer } from "@/components/json-code-viewer";
import { CodeEditorHeaderActions } from "@/components/shared/code-editor-header-actions";
import type { AutosaveStatus } from "@/hooks/useAutosave";

export type CommandCode = Record<string, unknown>[] | string | undefined;

interface CommandCodePanelProps {
  code: Record<string, unknown>[];
  isCreator: boolean;
  isEditing: boolean;
  editedCode: CommandCode;
  handleChange: (value: CommandCode) => void;
  status: AutosaveStatus;
  closeEditing: () => void;
  startEditing: () => void;
  title?: React.ReactNode;
  placeholder?: string;
  height?: string;
  borderless?: boolean;
}

export function CommandCodePanel({
  code,
  isCreator,
  isEditing,
  editedCode,
  handleChange,
  status,
  closeEditing,
  startEditing,
  title,
  placeholder,
  height = "700px",
  borderless = false,
}: CommandCodePanelProps) {
  if (isEditing) {
    return (
      <CommandCodeEditor
        value={editedCode ?? []}
        onChange={handleChange}
        label=""
        placeholder={placeholder}
        title={title}
        headerActions={<CodeEditorHeaderActions status={status} onClose={closeEditing} />}
        height={height}
        borderless={borderless}
      />
    );
  }

  return (
    <JsonCodeViewer
      value={code}
      height={height}
      title={title}
      onEditStart={isCreator ? startEditing : undefined}
      className={borderless ? "h-full rounded-none border-0 shadow-none" : undefined}
    />
  );
}
