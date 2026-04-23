import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MarkdownCell } from "@repo/api";

import { MarkdownCellComponent } from "./markdown-cell";

vi.mock("@repo/ui/components/rich-textarea", async () => {
  const actual = await vi.importActual("@repo/ui/components/rich-textarea");
  return {
    ...actual,
    RichTextarea: ({
      value,
      onChange,
      placeholder,
    }: {
      value: string;
      onChange: (v: string) => void;
      placeholder: string;
    }) => (
      <textarea
        data-testid="rich-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    ),
  };
});

vi.mock("@repo/ui/components/rich-text-renderer", async () => {
  const actual = await vi.importActual("@repo/ui/components/rich-text-renderer");
  return {
    ...actual,
    RichTextRenderer: ({ content }: { content: string }) => (
      <div data-testid="rich-renderer">{content}</div>
    ),
  };
});

function makeMarkdownCell(overrides: Partial<MarkdownCell> = {}): MarkdownCell {
  return {
    id: "md-1",
    type: "markdown",
    content: "",
    isCollapsed: false,
    ...overrides,
  };
}

function renderMarkdown(
  overrides: Partial<MarkdownCell> = {},
  props: Partial<React.ComponentProps<typeof MarkdownCellComponent>> = {},
) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const cell = makeMarkdownCell(overrides);
  const result = render(
    <MarkdownCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} {...props} />,
  );
  return { ...result, onUpdate, onDelete, cell };
}

describe("MarkdownCellComponent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts in edit mode with a textarea when content is empty", () => {
    renderMarkdown();
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write something...")).toBeInTheDocument();
  });

  it("starts in preview mode when content already exists", () => {
    renderMarkdown({ content: "<p>Hello world</p>" });
    expect(screen.getByTestId("rich-renderer")).toBeInTheDocument();
    expect(screen.getByText("<p>Hello world</p>")).toBeInTheDocument();
  });

  it("switches from preview to edit when the user clicks Edit", async () => {
    const user = userEvent.setup();
    renderMarkdown({ content: "<p>Notes here</p>" });

    await user.click(screen.getByText("Edit"));
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
  });

  it("switches from edit to preview when the user clicks Preview", async () => {
    const user = userEvent.setup();
    renderMarkdown(); // empty → starts in edit

    await user.click(screen.getByText("Preview"));
    expect(screen.getByText("Click to add content...")).toBeInTheDocument();
  });

  it("fires onUpdate as the user types content", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderMarkdown();

    await user.type(screen.getByTestId("rich-textarea"), "H");

    // Controlled input: first keystroke produces "H"
    const firstCall = onUpdate.mock.calls[0][0] as MarkdownCell;
    expect(firstCall.content).toBe("H");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows 'No content' in preview when readOnly and content is empty", () => {
    renderMarkdown({}, { readOnly: true });
    expect(screen.getByText("No content")).toBeInTheDocument();
  });

  it("hides Edit/Preview toggle in readOnly mode", () => {
    renderMarkdown({ content: "<p>Read only text</p>" }, { readOnly: true });
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    // Content is still shown
    expect(screen.getByTestId("rich-renderer")).toBeInTheDocument();
  });
});
