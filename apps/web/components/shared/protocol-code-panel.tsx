"use client";

import { JsonCodeViewer } from "@/components/json-code-viewer";
import ProtocolCodeEditor from "@/components/protocol-code-editor";
import { CodeEditorHeaderActions } from "@/components/shared/code-editor-header-actions";
import type { AutosaveStatus } from "@/hooks/useAutosave";

/** Protocol code is an array of cells; `string`/`undefined` cover transient
 *  editor states (raw text, pre-mount). */
export type ProtocolCode = Record<string, unknown>[] | string | undefined;

interface ProtocolCodePanelProps {
  code: Record<string, unknown>[];
  isCreator: boolean;
  isEditing: boolean;
  editedCode: ProtocolCode;
  handleChange: (value: ProtocolCode) => void;
  status: AutosaveStatus;
  closeEditing: () => void;
  startEditing: () => void;
  title?: React.ReactNode;
  placeholder?: string;
  height?: string;
  borderless?: boolean;
}

export function ProtocolCodePanel({
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
}: ProtocolCodePanelProps) {
  if (isEditing) {
    return (
      <ProtocolCodeEditor
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
