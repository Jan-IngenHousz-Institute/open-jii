import { stubIntersectionObserver } from "@/test/intersection-observer";
import { render, screen } from "@/test/test-utils";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeEditor } from "../code-editor";

vi.unmock("~/components/shared/code-editor");

vi.mock("../code-editor-view", () => ({
  CodeEditorView: ({ value }: { value: string }) => <div data-testid="codemirror">{value}</div>,
}));

describe("CodeEditor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the code as text on the server, where CodeMirror cannot draw", () => {
    const html = renderToString(<CodeEditor value='{"steps": 3}' language="json" />);

    expect(html).toContain("{&quot;steps&quot;: 3}");
    expect(html).not.toContain("codemirror");
  });

  it("keeps an editor far down the page as text until it comes within a screen", async () => {
    const { intersect, rootMargins } = stubIntersectionObserver();
    render(<CodeEditor value='{"steps": 3}' language="json" />);

    expect(screen.getByText('{"steps": 3}')).toBeInTheDocument();
    expect(screen.queryByTestId("codemirror")).toBeNull();
    expect(rootMargins()).toEqual(["100% 0px"]);

    intersect(true);

    expect(await screen.findByTestId("codemirror")).toHaveTextContent('{"steps": 3}');
  });
});
