import { fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InlineEditableDescription } from "./inline-editable-description";

vi.mock("@repo/ui/components/rich-textarea", () => ({
  RichTextarea: ({
    value,
    onChange,
    onBlur,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: (event: React.FocusEvent) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  ),
}));

vi.mock("@repo/ui/components/rich-text-renderer", () => ({
  RichTextRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

describe("InlineEditableDescription", () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps action buttons from blurring the editor before their click handlers run", async () => {
    const user = userEvent.setup();
    render(<InlineEditableDescription description="Original" hasAccess onSave={onSave} />);

    await user.click(screen.getByText("Original"));
    const editor = screen.getByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "Updated");

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const saveButton = screen.getByRole("button", { name: "Save" });

    expect(fireEvent.mouseDown(cancelButton)).toBe(false);
    expect(fireEvent.mouseDown(saveButton)).toBe(false);

    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Updated");
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
