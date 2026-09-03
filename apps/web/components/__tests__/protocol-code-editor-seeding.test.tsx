import { act, fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { JsonValue } from "@repo/api/domains/protocol/protocol.schema";

import ProtocolCodeEditor from "../protocol-code-editor";

const PROTOCOL = [{ label: "PAM", pulses: [10, 20, 30], detectors: [[1], [1]] }];

type Code = JsonValue | undefined;

/**
 * Mirrors `protocol-overview-content.tsx`: the editor's `onChange` feeds straight
 * back into its own `value` prop, and the empty fallback is `[]`. That loop is
 * what made a deferred initial seed destroy the protocol, so the seeding tests
 * have to run against it rather than against a static prop.
 */
function FeedbackParent({
  initialValue = PROTOCOL,
  onChange,
  onValidationChange,
}: {
  initialValue?: JsonValue;
  onChange?: (value: Code) => void;
  onValidationChange?: (valid: boolean) => void;
}) {
  const [editedCode, setEditedCode] = useState<Code>(initialValue);
  return (
    <ProtocolCodeEditor
      value={editedCode ?? []}
      onChange={(value) => {
        onChange?.(value);
        setEditedCode(value);
      }}
      onValidationChange={onValidationChange}
      label="Protocol Code"
    />
  );
}

const editorText = () => screen.getByTestId<HTMLTextAreaElement>("code-editor-textarea").value;

describe("ProtocolCodeEditor seeding", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never lets the fed-back value collapse the document to an empty array", async () => {
    // The regression: deferring the seed by one effect let the first debounced
    // onChange(undefined) reset the parent, so the editor seeded from `[]` and
    // autosave persisted an empty protocol just from opening the editor.
    const onChange = vi.fn();
    render(<FeedbackParent onChange={onChange} />);

    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => expect(JSON.parse(editorText())).toEqual(PROTOCOL));
    expect(onChange.mock.calls.some(([value]) => Array.isArray(value) && value.length === 0)).toBe(
      false,
    );
  });

  it("keeps the document intact when the stored preference is the non-default one", async () => {
    localStorage.setItem("openjii.json-format-style", "expanded");
    const onChange = vi.fn();
    render(<FeedbackParent onChange={onChange} />);

    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => expect(JSON.parse(editorText())).toEqual(PROTOCOL));
    // Hydration reflowed the seeded text rather than re-deriving it from the prop.
    expect(editorText()).toBe(JSON.stringify(PROTOCOL, null, 2));
    expect(onChange.mock.calls.some(([value]) => Array.isArray(value) && value.length === 0)).toBe(
      false,
    );
  });

  it("does not overwrite an edit made before the preference resolves", async () => {
    localStorage.setItem("openjii.json-format-style", "expanded");
    render(<FeedbackParent />);

    const typed = '[{"label":"edited"}]';
    // The mocked CodeEditor forwards onChange, which is what a keystroke does.
    fireEvent.change(screen.getByTestId("code-editor-textarea"), { target: { value: typed } });

    await vi.advanceTimersByTimeAsync(500);

    expect(editorText()).toBe(typed);
  });

  it("seeds a stored string document as quoted JSON", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const storedString = '[{"label":"stored string"}]';
    const onChange = vi.fn();
    render(<FeedbackParent initialValue={storedString} onChange={onChange} />);

    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(editorText()).toBe(JSON.stringify(storedString));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(storedString));
  });

  it("distinguishes an empty string document from an empty editor", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    render(
      <FeedbackParent
        initialValue=""
        onChange={onChange}
        onValidationChange={onValidationChange}
      />,
    );

    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(editorText()).toBe('""');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(""));
    await waitFor(() => expect(onValidationChange).toHaveBeenLastCalledWith(true));

    fireEvent.change(screen.getByTestId("code-editor-textarea"), { target: { value: "" } });
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(editorText()).toBe("");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps raw user text untouched while editing", async () => {
    render(<ProtocolCodeEditor value="stored" onChange={vi.fn()} label="Protocol Code" />);

    const raw = '[{"label":"as typed"}]';
    fireEvent.change(screen.getByTestId("code-editor-textarea"), { target: { value: raw } });
    await vi.advanceTimersByTimeAsync(500);

    expect(editorText()).toBe(raw);
  });
});
