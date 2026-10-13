import { render } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CodeEditorView } from "../code-editor-view";

interface CodeMirrorProps {
  onChange: (value: string) => void;
  basicSetup: object;
  extensions: unknown[];
}

const codeMirror = vi.hoisted(() => {
  const props: CodeMirrorProps[] = [];
  return { props };
});

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: CodeMirrorProps) => {
    codeMirror.props.push(props);
    return null;
  },
}));

describe("CodeEditorView", () => {
  it("keeps the props CodeMirror reconfigures on stable while the caller re-renders", () => {
    const firstChange = vi.fn();
    const secondChange = vi.fn();
    const { rerender } = render(
      <CodeEditorView
        value="{}"
        language="json"
        onChange={firstChange}
        basicSetup={{ tabSize: 2 }}
      />,
    );
    rerender(
      <CodeEditorView
        value="{}"
        language="json"
        onChange={secondChange}
        basicSetup={{ tabSize: 2 }}
      />,
    );

    const first = codeMirror.props.at(0);
    const last = codeMirror.props.at(-1);
    expect(last?.onChange).toBe(first?.onChange);
    expect(last?.basicSetup).toBe(first?.basicSetup);
    expect(last?.extensions).toBe(first?.extensions);

    last?.onChange("[]");
    expect(secondChange).toHaveBeenCalledWith("[]");
    expect(firstChange).not.toHaveBeenCalled();
  });
});
