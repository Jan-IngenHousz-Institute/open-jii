import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InlineToken } from "./inline-token";

function renderToken(props: Partial<Parameters<typeof InlineToken>[0]> = {}) {
  const onCommit = vi.fn();
  render(<InlineToken value="par_raw" label="Column" canEdit onCommit={onCommit} {...props} />);
  return { onCommit, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

describe("InlineToken", () => {
  it("reads as the value until it is clicked", () => {
    renderToken();

    expect(screen.getByRole("button", { name: "Column" })).toHaveTextContent("par_raw");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("commits what was typed when focus leaves", async () => {
    const { onCommit, user } = renderToken();

    await user.click(screen.getByRole("button", { name: "Column" }));
    const field = screen.getByRole("textbox", { name: "Column" });
    await user.clear(field);
    await user.type(field, "par");
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith("par");
  });

  it("commits on Enter without waiting for focus to move", async () => {
    const { onCommit, user } = renderToken();

    await user.click(screen.getByRole("button", { name: "Column" }));
    await user.type(screen.getByRole("textbox", { name: "Column" }), "_2{Enter}");

    expect(onCommit).toHaveBeenCalledWith("par_raw_2");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  // A sentence is read far more often than edited, so leaving an edit has to be free.
  it("abandons the edit on Escape and keeps the saved value", async () => {
    const { onCommit, user } = renderToken();

    await user.click(screen.getByRole("button", { name: "Column" }));
    await user.type(screen.getByRole("textbox", { name: "Column" }), "_2{Escape}");

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Column" })).toHaveTextContent("par_raw");
  });

  it("says nothing changed rather than committing the same value again", async () => {
    const { onCommit, user } = renderToken();

    await user.click(screen.getByRole("button", { name: "Column" }));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows a placeholder for an empty value, and it is not the value", async () => {
    const { onCommit, user } = renderToken({ value: "", placeholder: "no settle" });

    const token = screen.getByRole("button", { name: "Column" });
    expect(token).toHaveTextContent("no settle");

    await user.click(token);
    expect(screen.getByRole("textbox", { name: "Column" })).toHaveValue("");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("marks an invalid value on the token itself", () => {
    renderToken({ invalid: "That name is taken" });

    expect(screen.getByRole("button", { name: "Column" })).toHaveClass("text-destructive");
  });

  it("is plain text on a document nobody can edit", () => {
    renderToken({ canEdit: false });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("par_raw")).toBeInTheDocument();
  });
});
