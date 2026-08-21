import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CodeViewerFrame } from "../code-viewer-frame";

describe("CodeViewerFrame", () => {
  it("renders the header trio and its actions", () => {
    render(
      <CodeViewerFrame
        label="JSON"
        title="payload.json"
        stats="12 lines - 340 B"
        actions={<button type="button">Copy</button>}
      >
        <pre>{"{}"}</pre>
      </CodeViewerFrame>,
    );

    expect(screen.getByText("payload.json")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("12 lines - 340 B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("keeps the header above the hover overlay so its controls stay clickable", () => {
    const { container } = render(
      <CodeViewerFrame label="JSON" onEditStart={vi.fn()}>
        <pre>{"{}"}</pre>
      </CodeViewerFrame>,
    );

    const overlay = container.querySelector(".z-10");
    const header = container.querySelector(".z-20");
    expect(overlay).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(header?.textContent).toContain("JSON");
  });

  it("shows no overlay and no pointer cursor without onEditStart", () => {
    const { container } = render(
      <CodeViewerFrame label="JSON">
        <pre>{"{}"}</pre>
      </CodeViewerFrame>,
    );

    expect(container.querySelector(".lucide-pencil")).not.toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toContain("cursor-pointer");
  });

  it("calls onEditStart when the frame is clicked", async () => {
    const user = userEvent.setup();
    const onEditStart = vi.fn();
    render(
      <CodeViewerFrame label="JSON" onEditStart={onEditStart}>
        <pre>{"{}"}</pre>
      </CodeViewerFrame>,
    );

    await user.click(screen.getByTestId("code-viewer-frame"));
    expect(onEditStart).toHaveBeenCalled();
  });
});
