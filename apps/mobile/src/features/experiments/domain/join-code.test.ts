import { describe, expect, it } from "vitest";
import { formatJoinCodeInput, parseJoinCodeInput } from "~/features/experiments/domain/join-code";

describe("parseJoinCodeInput", () => {
  it.each([
    ["bare", "KP7Q4WMX"],
    ["hyphenated", "KP7Q-4WMX"],
    ["lowercase", "kp7q4wmx"],
    ["lowercase and hyphenated", "kp7q-4wmx"],
    ["spaced", "KP7Q 4WMX"],
    ["spaced and lowercase", "kp7q 4wmx"],
    ["padded", "  KP7Q-4WMX  "],
  ])("normalizes a %s code", (_label, input) => {
    expect(parseJoinCodeInput(input)).toBe("KP7Q4WMX");
  });

  it.each([
    ["with a locale segment", "https://openjii.org/en-US/join/KP7Q-4WMX"],
    ["without a locale segment", "https://openjii.org/join/KP7Q-4WMX"],
    ["with a trailing slash", "https://openjii.org/en-US/join/KP7Q-4WMX/"],
    ["with a query string", "https://openjii.org/en-US/join/KP7Q-4WMX?utm_source=poster"],
    ["with a fragment", "https://openjii.org/en-US/join/KP7Q-4WMX#top"],
    ["on another host", "http://192.168.1.20:3000/en-US/join/kp7q-4wmx"],
    ["as a deep link", "openjii://join/KP7Q-4WMX"],
  ])("reads the code out of a landing URL %s", (_label, input) => {
    expect(parseJoinCodeInput(input)).toBe("KP7Q4WMX");
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   \n\t "],
    ["undefined", undefined],
    ["null", null],
    ["free text", "see you at the workshop"],
    ["seven glyphs", "KP7Q4WM"],
    ["nine glyphs", "KP7Q4WMXA"],
    ["an excluded glyph", "KP7Q-4WM0"],
    ["a URL with no code in it", "https://openjii.org/en-US/platform/experiments"],
    ["a URL whose join segment is not a code", "https://openjii.org/en-US/join/hello"],
  ])("rejects %s", (_label, input) => {
    expect(parseJoinCodeInput(input)).toBeNull();
  });

  it("prefers the URL's own segment over the surrounding text", () => {
    expect(parseJoinCodeInput("Join us: https://openjii.org/en-US/join/KP7Q-4WMX")).toBe(
      "KP7Q4WMX",
    );
  });
});

describe("formatJoinCodeInput", () => {
  it.each([
    ["", ""],
    ["k", "K"],
    ["kp7q", "KP7Q"],
    ["kp7q4", "KP7Q-4"],
    ["kp7q 4wmx", "KP7Q-4WMX"],
    ["KP7Q-4WMX", "KP7Q-4WMX"],
  ])("groups %s as %s while typing", (raw, expected) => {
    expect(formatJoinCodeInput(raw)).toBe(expected);
  });

  it("stops at the code's length, so an extra keystroke changes nothing", () => {
    expect(formatJoinCodeInput("KP7Q4WMXZZZ")).toBe("KP7Q-4WMX");
  });

  it("collapses a pasted landing URL to the code it carries", () => {
    expect(formatJoinCodeInput("https://openjii.org/en-US/join/KP7Q-4WMX")).toBe("KP7Q-4WMX");
  });

  it("drops punctuation but keeps a look-alike glyph, so the error is visible", () => {
    expect(formatJoinCodeInput("kp7q_4wm0!")).toBe("KP7Q-4WM0");
  });
});
