import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationOperatorPrompt } from "./calibration-operator-prompt";

describe("CalibrationOperatorPrompt", () => {
  it("acknowledges a plain instruction on continue", async () => {
    const resolve = vi.fn();
    render(
      <CalibrationOperatorPrompt
        request={{ kind: "acknowledge", prompt: "Expose the sensor to bright light", resolve }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.continue" }));

    expect(resolve).toHaveBeenCalledWith(true);
  });

  it("declines an instruction the operator cannot carry out", async () => {
    const resolve = vi.fn();
    render(
      <CalibrationOperatorPrompt
        request={{ kind: "acknowledge", prompt: "Install the dark fixture", resolve }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.decline" }));

    expect(resolve).toHaveBeenCalledWith(false);
  });

  // A gated step is unsafe to perform unprepared, so the token has to be typed
  // exactly before the run may continue.
  it("keeps a gated instruction blocked until the token is typed exactly", async () => {
    const resolve = vi.fn();
    render(
      <CalibrationOperatorPrompt
        request={{
          kind: "acknowledge",
          prompt: "Install the dark fixture",
          confirm: "DARK",
          resolve,
        }}
      />,
    );

    const continueButton = screen.getByRole("button", { name: "iot.calibration.prompt.continue" });
    expect(continueButton).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "dark");
    expect(continueButton).toBeDisabled();

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "DARK");
    expect(continueButton).toBeEnabled();

    await userEvent.click(continueButton);
    expect(resolve).toHaveBeenCalledWith(true);
  });

  it("records a typed reference reading as a number", async () => {
    const resolve = vi.fn();
    render(
      <CalibrationOperatorPrompt
        request={{
          kind: "readValue",
          prompt: "Enter the reference meter reading",
          type: "number",
          resolve,
        }}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "176.4");
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));

    expect(resolve).toHaveBeenCalledWith(176.4);
  });

  it("refuses a non-numeric answer to a numeric question", async () => {
    const resolve = vi.fn();
    render(
      <CalibrationOperatorPrompt
        request={{ kind: "readValue", prompt: "Enter the reading", type: "number", resolve }}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "bright");
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));

    expect(await screen.findByText("iot.calibration.prompt.invalidNumber")).toBeInTheDocument();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("records a text answer as typed", async () => {
    const resolve = vi.fn();
    render(
      <CalibrationOperatorPrompt
        request={{ kind: "readValue", prompt: "Enter the card lot", type: "text", resolve }}
      />,
    );

    await userEvent.type(screen.getByRole("textbox"), "LOT-42");
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));

    expect(resolve).toHaveBeenCalledWith("LOT-42");
  });
});
