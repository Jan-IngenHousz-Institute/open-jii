import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { EditableCell } from "./editable-cell";

globalThis.React = React;

/* --------------------------------- Mocks --------------------------------- */

const mockSetIsEditingCell = vi.fn();

vi.mock("./metadata-context", () => ({
  useMetadata: () => ({
    setIsEditingCell: mockSetIsEditingCell,
  }),
}));

/* --------------------------------- Tests --------------------------------- */

describe("EditableCell", () => {
  const defaultProps = {
    value: "test value",
    rowId: "row1",
    columnId: "col1",
    type: "string" as const,
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("display mode", () => {
    it("renders value as text", () => {
      render(<EditableCell {...defaultProps} />);
      expect(screen.getByText("test value")).toBeInTheDocument();
    });

    it("renders placeholder for empty value", () => {
      render(<EditableCell {...defaultProps} value="" />);
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders null value with placeholder", () => {
      render(<EditableCell {...defaultProps} value={null} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is focusable with button role", () => {
      render(<EditableCell {...defaultProps} />);
      const cell = screen.getByRole("button");
      expect(cell).toHaveAttribute("tabIndex", "0");
    });
  });

  describe("entering edit mode", () => {
    it("enters edit mode on click", async () => {
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("test value");
    });

    it("enters edit mode on Enter key", () => {
      render(<EditableCell {...defaultProps} />);
      fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("enters edit mode on Space key", () => {
      render(<EditableCell {...defaultProps} />);
      fireEvent.keyDown(screen.getByRole("button"), { key: " " });
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("syncs editing state with context", async () => {
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} />);

      mockSetIsEditingCell.mockClear();
      await user.click(screen.getByRole("button"));

      expect(mockSetIsEditingCell).toHaveBeenCalledWith(true);
    });
  });

  describe("committing edits", () => {
    it("commits value on blur", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} onUpdate={onUpdate} />);

      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "new value");
      fireEvent.blur(input);

      expect(onUpdate).toHaveBeenCalledWith("row1", "col1", "new value");
    });

    it("commits value on Enter key", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} onUpdate={onUpdate} />);

      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "entered");
      await user.keyboard("{Enter}");

      expect(onUpdate).toHaveBeenCalledWith("row1", "col1", "entered");
    });

    it("does not call onUpdate when value unchanged", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} onUpdate={onUpdate} />);

      await user.click(screen.getByRole("button"));
      fireEvent.blur(screen.getByRole("textbox"));

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("cancelling edits", () => {
    it("reverts value on Escape and exits edit mode", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} onUpdate={onUpdate} />);

      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "changed");
      await user.keyboard("{Escape}");

      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByText("test value")).toBeInTheDocument();
    });
  });

  describe("number type", () => {
    it("renders number input when editing", async () => {
      const user = userEvent.setup();
      render(<EditableCell {...defaultProps} type="number" value={42} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("converts string input to number on commit", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <EditableCell
          {...defaultProps}
          type="number"
          value={42}
          onUpdate={onUpdate}
        />,
      );

      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("spinbutton");

      await user.clear(input);
      await user.type(input, "99");
      fireEvent.blur(input);

      expect(onUpdate).toHaveBeenCalledWith("row1", "col1", 99);
    });

    it("converts empty number to null", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <EditableCell
          {...defaultProps}
          type="number"
          value={42}
          onUpdate={onUpdate}
        />,
      );

      await user.click(screen.getByRole("button"));
      const input = screen.getByRole("spinbutton");

      await user.clear(input);
      fireEvent.blur(input);

      expect(onUpdate).toHaveBeenCalledWith("row1", "col1", null);
    });
  });

  describe("disabled state", () => {
    it("renders plain text without button role", () => {
      render(<EditableCell {...defaultProps} disabled />);

      expect(screen.getByText("test value")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders disabled empty value", () => {
      render(<EditableCell {...defaultProps} disabled value={null} />);

      // Shows empty string representation
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
