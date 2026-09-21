import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { AssistantProvider, useAssistant } from "./assistant-context";

function Probe() {
  const assistant = useAssistant();
  return (
    <div>
      <span>{assistant.enabled ? "enabled" : "disabled"}</span>
      <span>{assistant.open ? "open" : "closed"}</span>
      <button type="button" onClick={assistant.openAssistant}>
        Open
      </button>
    </div>
  );
}

describe("AssistantProvider", () => {
  it("opens the assistant for a cohort member", async () => {
    const user = userEvent.setup();
    render(
      <AssistantProvider enabled>
        <Probe />
      </AssistantProvider>,
    );

    expect(screen.getByText("enabled")).toBeInTheDocument();
    expect(screen.getByText("closed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("keeps the assistant closed when the cohort flag is off", async () => {
    const user = userEvent.setup();
    render(
      <AssistantProvider enabled={false}>
        <Probe />
      </AssistantProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});
