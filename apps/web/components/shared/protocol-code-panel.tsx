"use client";

import { JsonCodeViewer } from "@/components/json-code-viewer";
import ProtocolCodeEditor from "@/components/protocol-code-editor";
import { CodeEditorHeaderActions } from "@/components/shared/code-editor-header-actions";

import type { ProtocolCode } from "@/hooks/useProtocolCodeAutoSave";

interface ProtocolCodePanelProps {
  code: Record<string, unknown>[];
  isCreator: boolean;
  isEditing: boolean;
  editedCode: ProtocolCode;
  handleChange: (value: ProtocolCode) => void;
  syncStatus: "synced" | "unsynced" | "syncing";
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
  syncStatus,
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
        headerActions={<CodeEditorHeaderActions syncStatus={syncStatus} onClose={closeEditing} />}
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
      className={borderless ? "h-full border-0 rounded-none shadow-none" : undefined}
    />
  );
}
