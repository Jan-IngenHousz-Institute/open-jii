"use client";

import type { Monaco, OnMount } from "@monaco-editor/react";
import Editor from "@monaco-editor/react";
import { Copy, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import type { ZodIssue } from "zod";

import { validateProtocolJson } from "@repo/api";
import { Button, Label } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface ProtocolCodeEditorProps {
  value: Record<string, unknown>[] | string;
  onChange: (value: Record<string, unknown>[] | string | undefined) => void;
  label: string;
  placeholder?: string;
  error?: string;
}
type IStandaloneCodeEditor = Parameters<OnMount>[0];

function findLine(text: string, e: ZodIssue) {
  // Try to find the line number of the error path in the JSON
  // This is a best-effort guess, as Zod does not provide line numbers
  const codeLines = text.split("\n");
  let lineNumber = 0;
  let pathItem = e.path.pop();
  for (const codeLine of codeLines) {
    if (pathItem === undefined || typeof pathItem == "number") return lineNumber;
    if (codeLine.includes(`"${pathItem}"`)) {
      pathItem = e.path.pop();
    }
    lineNumber++;
  }
  return lineNumber;
}

const ProtocolCodeEditor: FC<ProtocolCodeEditorProps> = ({
  value,
  onChange,
  label,
  placeholder,
  error,
}) => {
  const [copied, setCopied] = useState(false);
  const [isValidJson, setIsValidJson] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);

  // Convert array to JSON string for editor if needed
  const editorValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  // Set Monaco error markers
  const setMarkers = (errors: string[], errorDetails?: { line: number; message: string }[]) => {
    if (monacoRef.current && editorRef.current) {
      const markerSeverityError = monacoRef.current.MarkerSeverity.Error;
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(
          model,
          "owner",
          (errorDetails ?? []).map((e) => ({
            startLineNumber: e.line,
            endLineNumber: e.line,
            startColumn: 1,
            endColumn: 1,
            message: e.message,
            severity: markerSeverityError,
          })),
        );
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editorValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getJsonStats = () => {
    const lines = editorValue.split("\n").length;
    const size = new Blob([editorValue]).size;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    return { lines, size: formatSize(size) };
  };

  const stats = getJsonStats();

  // Handle editor changes and always try to convert to array for validation
  const handleEditorChange = (newValue: string | undefined) => {
    if (!newValue) {
      onChange(newValue);
      setIsValidJson(true);
      return;
    }

    try {
      const parsedValue = JSON.parse(newValue) as unknown;
      setIsValidJson(true);

      // Validate with Zod
      const result = validateProtocolJson(parsedValue);
      if (!result.success && result.error) {
        setValidationErrors(result.error.map((e) => e.message));
        const errorDetails = result.error.map((e) => {
          return { line: findLine(newValue, e), message: e.message };
        });
        setMarkers(
          result.error.map((e) => e.message),
          errorDetails,
        );
      } else {
        setValidationErrors([]);
        setMarkers([]);
      }

      if (Array.isArray(parsedValue)) {
        onChange(parsedValue as Record<string, unknown>[]);
      } else {
        onChange(newValue);
      }
    } catch {
      setIsValidJson(false);
      setValidationErrors(["Invalid JSON syntax"]);
      setMarkers(["Invalid JSON syntax"], [{ line: 1, message: "Invalid JSON syntax" }]);
      onChange(newValue); // Keep the invalid JSON for editing
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    // Clear markers if error prop changes
    if (!error && monacoRef.current && editorRef.current) {
      setMarkers([]);
    }
  }, [error]);

  return (
    <div className="grid w-full gap-1.5">
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          "overflow-hidden rounded-md border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md",
          error && "border-destructive",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600">JSON</span>
            <span className="text-xs text-slate-500">
              {stats.lines} lines • {stats.size}
            </span>
            {!isValidJson && <span className="text-xs text-red-600">Invalid JSON</span>}
            {validationErrors.length > 0 && (
              <span className="text-xs text-red-600">
                {validationErrors[0]}
                {validationErrors.length > 1 && ` (+${validationErrors.length - 1} more)`}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 w-7 p-0 hover:bg-slate-200"
          >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        {/* Monaco Editor */}
        <div className="relative">
          {/* Placeholder overlay */}
          {!editorValue && placeholder && (
            <div className="pointer-events-none absolute left-4 top-4 z-10 text-sm text-slate-400">
              {placeholder}
            </div>
          )}
          <Editor
            height={700}
            language="json"
            value={editorValue}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            loading={
              <div className="flex h-full items-center justify-center bg-slate-50">
                <div className="animate-pulse text-sm text-slate-600">Loading code editor...</div>
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              lineHeight: 1.6,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              lineNumbers: "on",
              folding: true,
              contextmenu: true,
              selectOnLineNumbers: true,
              glyphMargin: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
              renderLineHighlight: "line",
              padding: { top: 16, bottom: 16 },
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
                useShadows: true,
              },
              smoothScrolling: true,
              cursorBlinking: "phase",
              renderValidationDecorations: "on",
              hideCursorInOverviewRuler: false,
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,
              },
            }}
            theme="vs-light"
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
};

export default ProtocolCodeEditor;
