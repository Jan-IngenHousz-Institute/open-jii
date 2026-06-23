import { fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { InlineEditableProfileField } from "./inline-editable-profile-field";

function renderField(
  overrides: Partial<React.ComponentProps<typeof InlineEditableProfileField>> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  render(
    <InlineEditableProfileField
      label={overrides.label ?? "Bio"}
      value={overrides.value}
      emptyValue={overrides.emptyValue ?? "Not set"}
      placeholder={overrides.placeholder}
      onSave={onSave}
      isPending={overrides.isPending}
      multiline={overrides.multiline}
    />,
  );
  return { onSave };
}

describe("InlineEditableProfileField", () => {
  describe("read mode", () => {
    it("shows the label and value, and enters edit mode prefilled on click", async () => {
      const user = userEvent.setup();
      renderField({ label: "Bio", value: "Loves plants" });

      expect(screen.getByText("Bio")).toBeInTheDocument();
      expect(screen.getByText("Loves plants")).toBeInTheDocument();

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("textbox")).toHaveValue("Loves plants");
    });

    it("shows the empty placeholder text when there is no value", () => {
      renderField({ value: null, emptyValue: "Not set" });

      expect(screen.getByText("Not set")).toBeInTheDocument();
    });

    it("treats a whitespace-only value as empty", () => {
      renderField({ value: "   ", emptyValue: "Not set" });

      expect(screen.getByText("Not set")).toBeInTheDocument();
    });

    it("enters edit mode with an empty input when there is no value", async () => {
      const user = userEvent.setup();
      renderField({ value: null });

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  describe("saving", () => {
    it("calls onSave with the edited value and leaves edit mode", async () => {
      const user = userEvent.setup();
      const { onSave } = renderField({ value: "old" });

      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "new value");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).toHaveBeenCalledWith("new value");
      await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    });

    it("skips onSave and leaves edit mode when the value is unchanged", async () => {
      const user = userEvent.setup();
      const { onSave } = renderField({ value: "unchanged" });

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("saves on Enter and cancels on Escape", async () => {
      const user = userEvent.setup();
      const { onSave } = renderField({ value: "start" });

      // Escape exits edit mode without saving.
      await user.click(screen.getByRole("button"));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();

      // Enter saves the edited value.
      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "edited");
      await user.keyboard("{Enter}");

      await waitFor(() => expect(onSave).toHaveBeenCalledWith("edited"));
    });
  });

  describe("cancelling", () => {
    it("exits edit mode when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const { onSave } = renderField({ value: "keep" });

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("cancels when focus leaves the field to an unrelated element", async () => {
      const user = userEvent.setup();
      renderField({ value: "keep" });

      await user.click(screen.getByRole("button"));
      // onBlur lives on the wrapping div; focusout bubbles up from the input.
      // Blur to an element that is not an edit action collapses the field.
      fireEvent.blur(screen.getByRole("textbox"), { relatedTarget: document.body });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("stays open when focus moves to an edit-action button", async () => {
      const user = userEvent.setup();
      renderField({ value: "keep" });

      await user.click(screen.getByRole("button"));
      const saveButton = screen.getByRole("button", { name: "Save" });

      // Focus moving to an edit-action button must not collapse the field.
      fireEvent.blur(screen.getByRole("textbox"), { relatedTarget: saveButton });

      // Still editing — the textbox remains.
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("variants", () => {
    it("renders a textarea when multiline and saves its edited value", async () => {
      const user = userEvent.setup();
      const { onSave } = renderField({ value: "long text", multiline: true });

      await user.click(screen.getByRole("button"));

      const textarea = screen.getByRole("textbox");
      expect(textarea.tagName).toBe("TEXTAREA");

      await user.clear(textarea);
      await user.type(textarea, "updated bio");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onSave).toHaveBeenCalledWith("updated bio"));
    });

    it("disables the inputs and actions while pending", async () => {
      const user = userEvent.setup();
      renderField({ value: "x", isPending: true });

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("textbox")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });
  });
});
