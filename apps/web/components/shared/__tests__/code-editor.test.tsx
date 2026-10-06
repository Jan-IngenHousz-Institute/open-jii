import { render } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CodeEditor } from "../code-editor";

vi.unmock("~/components/shared/code-editor");

interface CodeMirrorProps {
  onChange: (value: string) => void;
  basicSetup: object;
  extensions: unknown[];
}

const codeMirror = vi.hoisted(() => ({ props: [] as CodeMirrorProps[] }));

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: CodeMirrorProps) => {
    codeMirror.props.push(props);
    return null;
  },
}));

describe("CodeEditor", () => {
  it("keeps the props CodeMirror reconfigures on stable while the caller re-renders", () => {
    const firstChange = vi.fn();
    const secondChange = vi.fn();
    const { rerender } = render(
      <CodeEditor value="{}" language="json" onChange={firstChange} basicSetup={{ tabSize: 2 }} />,
    );
    rerender(
      <CodeEditor value="{}" language="json" onChange={secondChange} basicSetup={{ tabSize: 2 }} />,
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
