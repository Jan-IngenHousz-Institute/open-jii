import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { CommandPanelValue } from "../command-panel";
import { CommandPanel } from "../command-panel";

describe("CommandPanel", () => {
  it("renders the command content in an editable field", () => {
    render(<CommandPanel command={{ format: "string", content: "battery" }} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("battery");
  });

  it("calls onChange with the edited content", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CommandPanel command={{ format: "string", content: "" }} onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "h");
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.lastCall?.[0] as CommandPanelValue;
    expect(updated).toMatchObject({ command: { format: "string", content: "h" } });
  });

  it("defaults to an empty string command when no value is set yet", () => {
    render(<CommandPanel onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("shows a validation error for malformed JSON content", () => {
    render(<CommandPanel command={{ format: "json", content: "{not json" }} onChange={vi.fn()} />);
    expect(screen.getByText(/.+/, { selector: "p.text-red-500" })).toBeInTheDocument();
  });

  it("hides the format selector when disabled", () => {
    render(
      <CommandPanel
        command={{ format: "yaml", content: "cmd: battery" }}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("YAML")).toBeInTheDocument();
  });
});
