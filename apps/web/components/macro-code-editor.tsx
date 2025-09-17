"use client";

import { Editor } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { Check, Copy } from "lucide-react";
import React from "react";
import { useRef, useState } from "react";
import type { FC } from "react";

import { Button, Label } from "@repo/ui/components";

type CodeLanguage = "python" | "r" | "javascript";

interface MacroCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  label?: string;
  error?: string;
  height?: string;
  username?: string;
  macroName?: string;
}

const toSnakeCase = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "")
    .replace(/_+/g, "_");
};

const getMonacoLanguage = (language: CodeLanguage): string => {
  switch (language) {
    case "python":
      return "python";
    case "r":
      return "r";
    case "javascript":
      return "typescript"; // Monaco uses typescript for JavaScript with better features
    default:
      return "plaintext";
  }
};

const getLanguageExtension = (language: CodeLanguage): string => {
  switch (language) {
    case "python":
      return ".py";
    case "r":
      return ".R";
    case "javascript":
      return ".js";
    default:
      return ".txt";
  }
};

const getDefaultContent = (language: CodeLanguage, username?: string): string => {
  const date = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  switch (language) {
    case "python":
      return `# Macro for data evaluation on openjii.org
# by: ${username}
# created: ${date}

# Define Output Dictionary (required)
output = {}

# Insert your macro code here

# Return Output Dictionary (required)
return output
    `;
    case "r":
      return `# Macro for data evaluation on openjii.org
# by: ${username}
# created: ${date}

# Define Output List (required)
output <- list()

# Insert your macro code here

# Return Output List (required)
output
`;
    case "javascript":
      return `/**
 * Macro for data evaluation on openjii.org
 * by: ${username}
 * created: ${date}
 */

 // Define Output Object (required)
var output = {};

// Insert your macro code here

// Return Output Object (required)
return output;
`;
    default:
      return "";
  }
};

const MacroCodeEditor: FC<MacroCodeEditorProps> = ({
  value,
  onChange,
  language,
  label,
  error,
  username,
  height = "400px",
  macroName = "untitled",
}) => {
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const editorValue = value || getDefaultContent(language, username);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editorValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getCodeStats = () => {
    const lines = editorValue.split("\n").length;
    const size = new Blob([editorValue]).size;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    return { lines, size: formatSize(size) };
  };

  const stats = getCodeStats();

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Disable semantic validation for TypeScript/JavaScript
    // Keep syntax validation enabled
    // Monaco editor should always have TypeScript language support
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true, // Disable semantic validation
      noSyntaxValidation: false, // Keep syntax validation
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: stats.lines > 50 },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineHeight: 20,
      tabSize: language === "python" ? 4 : 2,
      insertSpaces: true,
      wordWrap: "on",
    });
  };

  const handleEditorChange = (newValue: string | undefined) => {
    onChange(newValue ?? "");
  };

  const errorClass = error ? " border-red-500" : "";

  return (
    <div className="grid w-full gap-1.5">
      {label && <Label>{label}</Label>}
      <div
        className={`overflow-hidden rounded-md border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md${errorClass}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">
              {toSnakeCase(macroName) + getLanguageExtension(language)}
            </span>
            <div className="text-xs text-slate-500">
              {stats.lines} lines • {stats.size}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2 text-slate-600 hover:text-slate-800"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        {/* Editor */}
        <div style={{ height }}>
          <Editor
            value={editorValue}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            language={getMonacoLanguage(language)}
            theme="vs"
            options={{
              automaticLayout: true,
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 20,
              tabSize: language === "python" ? 4 : 2,
              insertSpaces: true,
              wordWrap: "on",
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default MacroCodeEditor;
