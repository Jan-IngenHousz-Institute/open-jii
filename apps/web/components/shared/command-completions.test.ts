import type * as Autocomplete from "@codemirror/autocomplete";
import { completionStatus, startCompletion } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { KNOWN_DEVICE_COMMANDS } from "@repo/api/domains/workbook/device-command.schema";

import {
  buildCommandTooltipDom,
  commandCompletionSource,
  commandHoverSource,
  knownCommandAt,
  openCompletionsOnFocus,
  wordAt,
} from "./command-completions";

vi.mock("@codemirror/autocomplete", async (importOriginal) => {
  const actual = await importOriginal<typeof Autocomplete>();
  return {
    ...actual,
    completionStatus: vi.fn((): "active" | "pending" | null => null),
    startCompletion: vi.fn(),
  };
});

// A CodeMirror view is heavy to stand up in jsdom; these callbacks only touch
// the doc text / focus flags, so a structural stub is enough to exercise them.
function fakeView(doc: string, hasFocus = true): EditorView {
  return { hasFocus, state: { doc: { toString: () => doc } } } as unknown as EditorView;
}

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
    // "get flow"; cursor inside "flow"
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

describe("commandHoverSource", () => {
  it("anchors a tooltip to a known command and builds its description DOM", () => {
    const tip = commandHoverSource(fakeView("battery"), 2);
    expect(tip).not.toBeNull();
    expect(tip?.pos).toBe(0);
    expect(tip?.end).toBe(7);
    expect(tip?.above).toBe(true);
    const dom = tip?.create(fakeView("battery")).dom;
    expect(dom?.textContent).toContain("battery · Connection");
  });

  it("returns null when the cursor is not over a known command", () => {
    expect(commandHoverSource(fakeView("set_led_delay+1"), 2)).toBeNull();
    expect(commandHoverSource(fakeView(""), 0)).toBeNull();
  });
});

describe("openCompletionsOnFocus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("never opens the completion list when read-only", () => {
    const handler = openCompletionsOnFocus(true);
    const view = fakeView("battery");
    expect(handler(new FocusEvent("focus"), view)).toBe(false);
    vi.runAllTimers();
    expect(startCompletion).not.toHaveBeenCalled();
  });

  it("opens the completion list a tick after focus when idle and still focused", () => {
    const handler = openCompletionsOnFocus(false);
    const view = fakeView("battery");
    expect(handler(new FocusEvent("focus"), view)).toBe(false);
    // Deferred: not opened synchronously.
    expect(startCompletion).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(startCompletion).toHaveBeenCalledWith(view);
  });

  it("does not reopen when a completion is already active", () => {
    vi.mocked(completionStatus).mockReturnValueOnce("active");
    const handler = openCompletionsOnFocus(false);
    handler(new FocusEvent("focus"), fakeView("battery"));
    vi.runAllTimers();
    expect(startCompletion).not.toHaveBeenCalled();
  });

  it("does not open when focus was lost before the tick", () => {
    const handler = openCompletionsOnFocus(false);
    handler(new FocusEvent("focus"), fakeView("battery", false));
    vi.runAllTimers();
    expect(startCompletion).not.toHaveBeenCalled();
  });
});
