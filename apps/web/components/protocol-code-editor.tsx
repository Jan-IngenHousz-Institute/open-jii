"use client";

import type { Monaco, OnMount } from "@monaco-editor/react";
import Editor from "@monaco-editor/react";
import { Copy, Check } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { useDebounce } from "~/hooks/useDebounce";

import { FEATURE_FLAGS } from "@repo/analytics";
import { findProtocolErrorLine, getErrorMessage, validateProtocolJson } from "@repo/api";
import { Button, Label } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface ProtocolCodeEditorProps {
  value: Record<string, unknown>[] | string;
  onChange: (value: Record<string, unknown>[] | string | undefined) => void;
  onValidationChange?: (isValid: boolean) => void;
  label: string;
  placeholder?: string;
  error?: string;
}
type IStandaloneCodeEditor = Parameters<OnMount>[0];

const ProtocolCodeEditor: FC<ProtocolCodeEditorProps> = ({
  value,
  onChange,
  onValidationChange,
  label,
  placeholder,
  error,
}) => {
  const [copied, setCopied] = useState(false);
  const [isValidJson, setIsValidJson] = useState(true);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const [editorCode, setEditorCode] = useState<string | undefined>(undefined);
  const [debouncedEditorCode] = useDebounce(editorCode, 200);
  const isUserEditingRef = useRef(false);

  // Check feature flag for validation strategy
  const validationAsWarning = useFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING);

  // Convert array to JSON string for editor if needed
  const initialEditorValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  // Initialize editor code from props only once
  useEffect(() => {
    if (editorCode === undefined && !isUserEditingRef.current) {
      setEditorCode(initialEditorValue);
    }
  }, [initialEditorValue, editorCode]);

  // Use editor code for display, or fall back to prop value
  const editorValue = editorCode ?? initialEditorValue;

  // Set Monaco markers (errors or warnings based on validation mode)
  const setMarkers = (
    messages: string[],
    messageDetails?: { line: number; message: string }[],
    asError = false,
  ) => {
    if (monacoRef.current && editorRef.current) {
      const markerSeverityWarning = monacoRef.current.MarkerSeverity.Warning;
      const markerSeverityError = monacoRef.current.MarkerSeverity.Error;
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(
          model,
          "owner",
          (messageDetails ?? []).map((e) => ({
            startLineNumber: e.line,
            endLineNumber: e.line,
            startColumn: 1,
            endColumn: 1,
            message: e.message,
            // Use Error severity for JSON syntax errors or when in strict mode
            // Use Warning severity when in warning mode
            severity:
              e.message === "Invalid JSON syntax" || asError
                ? markerSeverityError
                : markerSeverityWarning,
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

  useEffect(() => {
    if (!debouncedEditorCode) {
      onChange(debouncedEditorCode);
      setIsValidJson(true);
      onValidationChange?.(true);
      return;
    }

    try {
      const parsedValue = JSON.parse(debouncedEditorCode) as unknown;
      setIsValidJson(true);

      // If feature flag is enabled (validation as warning), skip protocol validation
      // If feature flag is disabled (strict mode), do full protocol validation
      if (!validationAsWarning) {
        // Strict mode: validate protocol and show as errors (block save)
        const result = validateProtocolJson(parsedValue);
        if (!result.success && result.error) {
          setValidationWarnings(result.error.map((e) => getErrorMessage(e)));
          const warningDetails = result.error.map((e) => {
            return findProtocolErrorLine(debouncedEditorCode, e);
          });
          setMarkers(
            result.error.map((e) => e.message),
            warningDetails,
            true, // Show as errors (red) in strict mode
          );
          // Block save in strict mode
          onChange(undefined);
          onValidationChange?.(false);
          return;
        } else {
          setValidationWarnings([]);
          setMarkers([]);
          onValidationChange?.(true);
        }
      } else {
        // Warning mode: show protocol validation as warnings but allow save
        const result = validateProtocolJson(parsedValue);
        if (!result.success && result.error) {
          setValidationWarnings(result.error.map((e) => getErrorMessage(e)));
          const warningDetails = result.error.map((e) => {
            return findProtocolErrorLine(debouncedEditorCode, e);
          });
          setMarkers(
            result.error.map((e) => e.message),
            warningDetails,
            false, // Show as warnings (yellow) in warning mode
          );
        } else {
          setValidationWarnings([]);
          setMarkers([]);
        }
        onValidationChange?.(true);
      }

      if (Array.isArray(parsedValue)) {
        onChange(parsedValue as Record<string, unknown>[]);
      } else {
        onChange(debouncedEditorCode);
      }
    } catch {
      setIsValidJson(false);
      setValidationWarnings(["Invalid JSON syntax"]);
      setMarkers(["Invalid JSON syntax"], [{ line: 1, message: "Invalid JSON syntax" }]);
      onChange(undefined); // Don't save invalid JSON
      onValidationChange?.(false);
    }
  }, [debouncedEditorCode, onChange, onValidationChange, validationAsWarning]);

  // Handle editor changes and always try to convert to array for validation
  const handleEditorChange = (newValue: string | undefined) => {
    isUserEditingRef.current = true;
    setEditorCode(newValue);
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
            {validationWarnings.length > 0 && isValidJson && (
              <span
                className={cn("text-xs", validationAsWarning ? "text-yellow-600" : "text-red-600")}
              >
                {validationWarnings[0]}
                {validationWarnings.length > 1 && ` (+${validationWarnings.length - 1} more)`}
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
