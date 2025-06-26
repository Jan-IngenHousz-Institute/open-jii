"use client";

import Editor from "@monaco-editor/react";
import type { FC } from "react";

import { Label } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface ProtocolCodeEditorProps {
  value: Record<string, unknown>[] | string;
  onChange: (value: Record<string, unknown>[] | string | undefined) => void;
  label: string;
  placeholder?: string;
  error?: string;
}

const ProtocolCodeEditor: FC<ProtocolCodeEditorProps> = ({
  value,
  onChange,
  label,
  placeholder,
  error,
}) => {
  // Convert array to JSON string for editor if needed
  const editorValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  // Handle editor changes and always try to convert to array for validation
  const handleEditorChange = (newValue: string | undefined) => {
    if (!newValue) {
      onChange(newValue);
      return;
    }

    try {
      const parsedValue = JSON.parse(newValue) as unknown;

      if (Array.isArray(parsedValue)) {
        onChange(parsedValue as Record<string, unknown>[]);
      }
    } catch (error) {
      console.error("Invalid JSON:", error);

      onChange([{}]);
    }
  };
  return (
    <div className="grid w-full gap-1.5">
      <Label>{label}</Label>
      <div className={cn("relative rounded-md border", error && "border-destructive")}>
        {/* The monaco editor doesn't have a placeholder, so we fake one. */}
        {!editorValue && placeholder && (
          <div className="text-muted-foreground pointer-events-none absolute left-[14px] top-2.5 z-10 text-sm">
            {placeholder}
          </div>
        )}
        <Editor
          height="400px"
          language="json"
          value={editorValue}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
          }}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
};

export default ProtocolCodeEditor;
