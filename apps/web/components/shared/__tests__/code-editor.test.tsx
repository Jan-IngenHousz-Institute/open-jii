import { render, screen } from "@/test/test-utils";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CodeEditor } from "../code-editor";

vi.unmock("~/components/shared/code-editor");

vi.mock("../code-editor-view", () => ({
  CodeEditorView: ({ value }: { value: string }) => <div data-testid="codemirror">{value}</div>,
}));

describe("CodeEditor", () => {
  it("renders the code as text on the server, where CodeMirror cannot draw", () => {
    const html = renderToString(<CodeEditor value='{"steps": 3}' language="json" />);

    expect(html).toContain("{&quot;steps&quot;: 3}");
    expect(html).not.toContain("codemirror");
  });

  it("swaps the text for the editor once CodeMirror has loaded", async () => {
    render(<CodeEditor value='{"steps": 3}' language="json" />);

    expect(await screen.findByTestId("codemirror")).toHaveTextContent('{"steps": 3}');
  });
});
