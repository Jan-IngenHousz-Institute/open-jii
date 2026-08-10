"use client";

import { JsonCodeViewer } from "@/components/json-code-viewer";
import ProtocolCodeEditor from "@/components/protocol-code-editor";
import { CodeEditorHeaderActions } from "@/components/shared/code-editor-header-actions";
import type { AutosaveStatus } from "@/hooks/useAutosave";

export type ProtocolCode = Record<string, unknown>[] | string | undefined;

interface ProtocolCodePanelProps {
  code: Record<string, unknown>[];
  /** `can(update)`: gating here moved from creator-identity to capability. */
  canEdit: boolean;
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
  canEdit,
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
      onEditStart={canEdit ? startEditing : undefined}
      className={borderless ? "h-full rounded-none border-0 shadow-none" : undefined}
    />
  );
}
