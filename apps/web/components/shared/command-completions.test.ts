import { describe, it, expect } from "vitest";

import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";

import {
  buildCommandTooltipDom,
  commandCompletionSource,
  knownCommandAt,
  wordAt,
} from "./command-completions";

interface FakeContext {
  matchBefore: (re: RegExp) => { from: number; to: number; text: string } | null;
  explicit: boolean;
}

function context(
  match: { from: number; to: number; text: string } | null,
  explicit = false,
): FakeContext {
  return { matchBefore: () => match, explicit };
}

describe("wordAt", () => {
  it("returns the contiguous non-whitespace word under the position", () => {
    expect(wordAt("battery", 3)).toEqual({ from: 0, to: 7, text: "battery" });
  });

  it("finds the word when the cursor sits between multiple tokens", () => {
    // "get flow" — cursor inside "flow"
    expect(wordAt("get flow", 6)).toEqual({ from: 4, to: 8, text: "flow" });
  });

  it("returns null on whitespace / empty doc", () => {
    expect(wordAt("", 0)).toBeNull();
    expect(wordAt("a  b", 2)).toBeNull(); // flanked by spaces
  });
});

describe("commandCompletionSource", () => {
  it("returns all known commands as options when a word is being typed", () => {
    const result = commandCompletionSource(context({ from: 0, to: 3, text: "bat" }) as never);
    expect(result).not.toBeNull();
    expect(result?.from).toBe(0);
    expect(result?.options).toHaveLength(KNOWN_DEVICE_COMMANDS.length);
    const battery = result?.options.find((o) => o.label === "battery");
    expect(battery?.detail).toBe("Connection");
    expect(battery?.info).toBe("Charge level in percent");
  });

  it("returns null on empty input unless explicitly requested", () => {
    expect(commandCompletionSource(context({ from: 2, to: 2, text: "" }) as never)).toBeNull();
  });

  it("returns options on empty input when explicit (Ctrl-Space)", () => {
    const result = commandCompletionSource(context({ from: 2, to: 2, text: "" }, true) as never);
    expect(result?.options).toHaveLength(KNOWN_DEVICE_COMMANDS.length);
  });

  it("returns null when there is no match before the cursor", () => {
    expect(commandCompletionSource(context(null) as never)).toBeNull();
  });
});

describe("knownCommandAt", () => {
  it("resolves a known command under the cursor", () => {
    const hit = knownCommandAt("battery", 2);
    expect(hit?.option.value).toBe("battery");
    expect(hit?.from).toBe(0);
    expect(hit?.to).toBe(7);
  });

  it("returns null for an unknown / custom command", () => {
    expect(knownCommandAt("set_led_delay+1", 2)).toBeNull();
  });

  it("returns null when the cursor is not on a word", () => {
    expect(knownCommandAt("", 0)).toBeNull();
  });
});

describe("buildCommandTooltipDom", () => {
  it("renders the command, group and description", () => {
    const dom = buildCommandTooltipDom({
      value: "battery",
      label: "Battery",
      group: "Connection",
      description: "Charge level in percent",
    });
    expect(dom.textContent).toContain("battery · Connection");
    expect(dom.textContent).toContain("Charge level in percent");
  });

  it("omits the description block when there is none", () => {
    const dom = buildCommandTooltipDom({ value: "memory", label: "Memory", group: "Device info" });
    expect(dom.textContent).toBe("memory · Device info");
    expect(dom.children).toHaveLength(1);
  });
});
