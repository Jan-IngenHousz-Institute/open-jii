import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "../input-group";

describe("InputGroupAddon", () => {
  it.each([
    ["input", <InputGroupInput key="input" aria-label="Input control" />],
    ["textarea", <InputGroupTextarea key="textarea" aria-label="Textarea control" />],
  ])("focuses its %s control when the addon is clicked", (_type, control) => {
    render(
      <InputGroup>
        {control}
        <InputGroupAddon>Units</InputGroupAddon>
      </InputGroup>,
    );

    fireEvent.click(screen.getByText("Units"));
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("leaves focus behavior to buttons inside an addon", () => {
    const onClick = vi.fn();
    render(
      <InputGroup>
        <InputGroupInput aria-label="Input control" />
        <InputGroupAddon>
          <InputGroupButton onClick={onClick}>Clear</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });
});
