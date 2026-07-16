import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { WorkbookDescription } from "./workbook-description";

vi.mock("@repo/ui/components/rich-textarea", () => ({
  RichTextarea: ({
    value,
    onChange,
    placeholder,
    isDisabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    isDisabled: boolean;
  }) => (
    <textarea
      data-testid="rich-textarea"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={isDisabled}
    />
  ),
}));

vi.mock("@repo/ui/components/rich-text-renderer", () => ({
  RichTextRenderer: ({ content }: { content: string }) => (
    <div data-testid="rich-text-renderer">{content}</div>
  ),
}));

describe("WorkbookDescription", () => {
  it("renders the existing description", () => {
    render(
      <WorkbookDescription workbookId="wb-1" description="Measures chlorophyll fluorescence" />,
    );

    expect(screen.getByText("Measures chlorophyll fluorescence")).toBeInTheDocument();
  });

  it("does not enter edit mode without access", async () => {
    const user = userEvent.setup();
    render(<WorkbookDescription workbookId="wb-1" description="Read only" />);

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) await user.click(descriptionContainer);

    expect(screen.queryByTestId("rich-textarea")).not.toBeInTheDocument();
  });

  it("updates the workbook description", async () => {
    const updateSpy = server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1", description: "New description" }),
    });
    const user = userEvent.setup();
    render(<WorkbookDescription workbookId="wb-1" description="Old description" hasAccess />);

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) await user.click(descriptionContainer);

    const textarea = screen.getByTestId("rich-textarea");
    await user.clear(textarea);
    await user.type(textarea, "New description");
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(updateSpy.called).toBe(true));
    expect(updateSpy.params).toMatchObject({ id: "wb-1" });
    expect(updateSpy.body).toEqual({ description: "New description" });
  });
});
