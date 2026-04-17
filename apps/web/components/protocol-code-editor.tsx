"use client";

import type { Monaco, OnMount } from "@monaco-editor/react";
import Editor from "@monaco-editor/react";
import { Copy, Check } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { useDebounce } from "~/hooks/useDebounce";

import { FEATURE_FLAGS } from "@repo/analytics";
import {
  findProtocolErrorLine,
  getErrorMessage,
  validateProtocolJson,
} from "@repo/api/schemas/protocol-validator";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

interface ProtocolCodeEditorProps {
  value: Record<string, unknown>[] | string;
  onChange: (value: Record<string, unknown>[] | string | undefined) => void;
  onValidationChange?: (isValid: boolean) => void;
  label: string;
  placeholder?: string;
  error?: string;
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
  height?: number | string;
  borderless?: boolean;
  readOnly?: boolean;
}
type IStandaloneCodeEditor = Parameters<OnMount>[0];

const ProtocolCodeEditor: FC<ProtocolCodeEditorProps> = ({
  value,
  onChange,
  onValidationChange,
  label,
  placeholder,
  error,
  title,
  headerActions,
  height = 700,
  borderless = false,
  readOnly = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isValidJson, setIsValidJson] = useState(true);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const [editorCode, setEditorCode] = useState<string | undefined>(undefined);
  const [debouncedEditorCode] = useDebounce(editorCode, 200);
  const isUserEditingRef = useRef(false);

  // Stable refs for callbacks to avoid infinite effect re-runs
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  // Check feature flag for validation strategy — default to strict mode when flag hasn't resolved
  const validationAsWarning =
    useFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING) ?? false;

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
      onChangeRef.current(debouncedEditorCode);
      setIsValidJson(true);
      onValidationChangeRef.current?.(true);
      return;
    }

    try {
      const parsedValue = JSON.parse(debouncedEditorCode) as unknown;
      setIsValidJson(true);

      // Validate protocol schema
      const result = validateProtocolJson(parsedValue);

      if (!result.success && result.error) {
        // Set validation warnings
        setValidationWarnings(result.error.map((e) => getErrorMessage(e)));
        const warningDetails = result.error.map((e) => {
          return findProtocolErrorLine(debouncedEditorCode, e);
        });

        // Show as errors (red) in strict mode, warnings (yellow) in warning mode
        const asError = !validationAsWarning;
        setMarkers(
          result.error.map((e) => e.message),
          warningDetails,
          asError,
        );

        // Block save only in strict mode
        if (!validationAsWarning) {
          onChangeRef.current(undefined);
          onValidationChangeRef.current?.(false);
          return;
        }
      } else {
        // Clear validation state when protocol is valid
        setValidationWarnings([]);
        setMarkers([]);
      }

      // Always set valid in warning mode, or when validation passes
      onValidationChangeRef.current?.(true);

      // Return parsed value
      if (Array.isArray(parsedValue)) {
        onChangeRef.current(parsedValue as Record<string, unknown>[]);
      } else {
        onChangeRef.current(debouncedEditorCode);
      }
    } catch (e) {
      setIsValidJson(false);
      setValidationWarnings(["Invalid JSON syntax"]);

      // Try to find the actual line number where JSON parsing failed
      let errorLine = 1;
      if (e instanceof SyntaxError && e.message) {
        const lineRegex = /position (\d+)/;
        const lineMatch = lineRegex.exec(e.message);
        if (lineMatch) {
          const position = parseInt(lineMatch[1], 10);
          // Calculate line number from position
          errorLine = debouncedEditorCode.substring(0, position).split("\n").length;
        }
      }

      setMarkers(
        ["Invalid JSON syntax"],
        [{ line: errorLine, message: "Invalid JSON syntax" }],
        true, // Always show JSON errors as errors (red)
      );
      onChangeRef.current(undefined); // Don't save invalid JSON
      onValidationChangeRef.current?.(false);
    }
  }, [debouncedEditorCode, validationAsWarning]);

  // Handle editor changes and always try to convert to array for validation
  const handleEditorChange = (newValue: string | undefined) => {
    isUserEditingRef.current = true;
    setEditorCode(newValue);
  };

  const handleEditorMount = (editor: IStandaloneCodeEditor, monaco: Monaco) => {
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
    <div className={cn("grid w-full", borderless ? "h-full" : "gap-1.5")}>
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          "overflow-hidden",
          borderless
            ? "flex h-full flex-col"
            : "rounded-md border border-slate-200 shadow-xs transition-shadow duration-200 hover:shadow-md",
          error && !borderless && "border-destructive",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
          <div className="flex items-center gap-3">
            {title && <span className="text-sm font-medium text-slate-700">{title}</span>}
            {title && <span className="text-slate-300">|</span>}
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
          <div className="flex items-center gap-2">
            {headerActions}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 w-7 p-0 hover:bg-slate-200"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{copied ? "Copied!" : "Copy code"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className={cn("relative", borderless && "flex-1")}>
          {/* Placeholder overlay */}
          {!editorValue && placeholder && (
            <div className="pointer-events-none absolute left-12 top-4 z-10 text-sm text-slate-400">
              {placeholder}
            </div>
          )}
          <Editor
            height={height}
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
              readOnly,
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
