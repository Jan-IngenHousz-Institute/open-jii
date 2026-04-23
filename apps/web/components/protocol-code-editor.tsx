"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { Diagnostic } from "@codemirror/lint";
import { Check, Copy } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { CodeEditor } from "~/components/shared/code-editor";
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

function computeProtocolDiagnostics(doc: string, asWarning: boolean): Diagnostic[] {
  if (!doc.trim()) return [];
  const diagnostics: Diagnostic[] = [];
  try {
    const parsed = JSON.parse(doc) as unknown;
    const result = validateProtocolJson(parsed);
    if (!result.success && result.error) {
      for (const issue of result.error) {
        const { line, message } = findProtocolErrorLine(doc, issue);
        const docLines = doc.split("\n");
        let from = 0;
        for (let i = 0; i < Math.min(line - 1, docLines.length); i++) {
          from += docLines[i].length + 1;
        }
        const to = from + (docLines[line - 1]?.length ?? 0);
        diagnostics.push({ from, to, severity: asWarning ? "warning" : "error", message });
      }
    }
  } catch (e) {
    let errorPos = 0;
    if (e instanceof SyntaxError && e.message) {
      const posMatch = /position (\d+)/.exec(e.message);
      if (posMatch) errorPos = parseInt(posMatch[1], 10);
    }
    diagnostics.push({
      from: Math.min(errorPos, doc.length),
      to: Math.min(errorPos + 1, doc.length),
      severity: "error",
      message: "Invalid JSON syntax",
    });
  }
  return diagnostics;
}

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
  const { copy: copyToClipboard, copied } = useCopyToClipboard();
  const [isValidJson, setIsValidJson] = useState(true);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [editorCode, setEditorCode] = useState<string | undefined>(undefined);
  const [debouncedEditorCode] = useDebounce(editorCode, 200);
  const isUserEditingRef = useRef(false);

  // Stable refs for callbacks to avoid infinite effect re-runs
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  // Check feature flag for validation strategy - default to strict mode when flag hasn't resolved
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

  const handleCopy = async () => {
    await copyToClipboard(editorValue);
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

  // Validation effect - runs on debounced code changes
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
        setValidationWarnings(result.error.map((e) => getErrorMessage(e)));

        // Block save only in strict mode
        if (!validationAsWarning) {
          onChangeRef.current(undefined);
          onValidationChangeRef.current?.(false);
          return;
        }
      } else {
        setValidationWarnings([]);
      }

      // Always set valid in warning mode, or when validation passes
      onValidationChangeRef.current?.(true);

      // Return parsed value
      if (Array.isArray(parsedValue)) {
        onChangeRef.current(parsedValue as Record<string, unknown>[]);
      } else {
        onChangeRef.current(debouncedEditorCode);
      }
    } catch {
      setIsValidJson(false);
      setValidationWarnings(["Invalid JSON syntax"]);
      onChangeRef.current(undefined);
      onValidationChangeRef.current?.(false);
    }
  }, [debouncedEditorCode, validationAsWarning]);

  const handleChange = useCallback((val: string) => {
    isUserEditingRef.current = true;
    setEditorCode(val);
  }, []);

  // Stable ref for the validation mode so lint source can read it without recreating
  const validationAsWarningRef = useRef(validationAsWarning);
  validationAsWarningRef.current = validationAsWarning;

  const protocolLintSource = useCallback(
    (doc: string): Diagnostic[] => computeProtocolDiagnostics(doc, validationAsWarningRef.current),
    [],
  );

  const heightStr = typeof height === "number" ? `${height}px` : height;

  return (
    <div className={cn("grid w-full", borderless ? "h-full" : "gap-1.5")}>
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          "overflow-hidden",
          borderless
            ? "flex h-full flex-col"
            : "rounded-md border border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md",
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
              {stats.lines} lines - {stats.size}
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

        {/* CodeMirror Editor */}
        <div className={cn("relative", borderless && "flex-1")}>
          {/* Placeholder overlay */}
          {!editorValue && placeholder && (
            <div className="pointer-events-none absolute left-12 top-4 z-10 text-sm text-slate-400">
              {placeholder}
            </div>
          )}
          <CodeEditor
            value={editorValue}
            onChange={handleChange}
            language="json"
            height={heightStr}
            readOnly={readOnly}
            lintSource={protocolLintSource}
            lintDelay={300}
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
};

export default ProtocolCodeEditor;
