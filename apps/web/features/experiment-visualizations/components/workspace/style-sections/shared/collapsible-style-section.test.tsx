import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CollapsibleStyleSection } from "./collapsible-style-section";

describe("CollapsibleStyleSection", () => {
  it("hides the children by default (collapsed)", () => {
    render(
      <CollapsibleStyleSection title="Bars">
        <div>hidden body</div>
      </CollapsibleStyleSection>,
    );
    expect(screen.queryByText("hidden body")).not.toBeInTheDocument();
  });

  it("renders children initially when defaultOpen=true", () => {
    render(
      <CollapsibleStyleSection title="Bars" defaultOpen>
        <div>visible body</div>
      </CollapsibleStyleSection>,
    );
    expect(screen.getByText("visible body")).toBeInTheDocument();
  });

  it("reveals the body when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleStyleSection title="Bars">
        <div>revealed body</div>
      </CollapsibleStyleSection>,
    );

    await user.click(screen.getByRole("button", { name: "Bars" }));
    expect(screen.getByText("revealed body")).toBeInTheDocument();
  });

  it("hides the body again after a second click on the trigger", async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleStyleSection title="Bars" defaultOpen>
        <div>folding body</div>
      </CollapsibleStyleSection>,
    );

    expect(screen.getByText("folding body")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bars" }));
    expect(screen.queryByText("folding body")).not.toBeInTheDocument();
  });

  it("renders the title as a level-three heading", () => {
    render(
      <CollapsibleStyleSection title="My title">
        <div>x</div>
      </CollapsibleStyleSection>,
    );
    expect(screen.getByRole("heading", { name: "My title", level: 3 })).toBeInTheDocument();
  });
});
