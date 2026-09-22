import { describe, expect, it } from "vitest";

import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  formatJoinCode,
  normalizeJoinCode,
  zCreateJoinCodeBody,
  zJoinCodePathParam,
  zJoinCodeValue,
} from "./experiment-join-codes.schema";

describe("the join code alphabet", () => {
  it("leaves out every glyph that has a look-alike", () => {
    for (const glyph of ["0", "O", "1", "I", "L"]) {
      expect({ glyph, present: JOIN_CODE_ALPHABET.includes(glyph) }).toEqual({
        glyph,
        present: false,
      });
    }
  });

  it("has no repeated glyph", () => {
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(JOIN_CODE_ALPHABET.length);
  });
});

describe("normalizeJoinCode", () => {
  /**
   * The projector shows `KP7Q-4WMX`, the phone keyboard may add a space, and the
   * deep link carries the bare value. All three have to be one code, on the client
   * and on the server.
   */
  it.each([
    ["kp7q-4wmx", "KP7Q4WMX"],
    ["KP7Q 4WMX", "KP7Q4WMX"],
    ["KP7Q4WMX", "KP7Q4WMX"],
    ["  kp7q - 4wmx  ", "KP7Q4WMX"],
    ["kp7q\t4wmx", "KP7Q4WMX"],
  ])("reads %j as %j", (raw, expected) => {
    expect(normalizeJoinCode(raw)).toBe(expected);
  });
});

describe("formatJoinCode", () => {
  it("splits a full-length code for display", () => {
    expect(formatJoinCode("KP7Q4WMX")).toBe("KP7Q-4WMX");
  });

  it("normalizes before splitting, so a formatted code round-trips", () => {
    expect(formatJoinCode("kp7q-4wmx")).toBe("KP7Q-4WMX");
  });

  it("leaves a value that is not a full code alone rather than mis-hyphenating it", () => {
    expect(formatJoinCode("KP7Q")).toBe("KP7Q");
  });
});

describe("zJoinCodeValue", () => {
  it.each(["kp7q-4wmx", "KP7Q 4WMX", "KP7Q4WMX"])("accepts %j and normalizes it", (raw) => {
    expect(zJoinCodeValue.parse(raw)).toBe("KP7Q4WMX");
  });

  it("rejects a glyph outside the alphabet", () => {
    // `0` is the look-alike the alphabet drops; a typo for `O` must not resolve.
    expect(zJoinCodeValue.safeParse("KP7Q-4WM0").success).toBe(false);
  });

  it.each([
    ["seven glyphs", "KP7Q4WM"],
    ["nine glyphs", "KP7Q4WMXY"],
    ["empty", ""],
  ])("rejects %s", (_label, raw) => {
    expect(zJoinCodeValue.safeParse(raw).success).toBe(false);
  });

  it("rejects a value that is only long enough before normalization", () => {
    expect(zJoinCodeValue.safeParse("KP7Q-4WM").success).toBe(false);
  });

  it("accepts every glyph the generator can draw", () => {
    for (const glyph of JOIN_CODE_ALPHABET) {
      const code = glyph.repeat(JOIN_CODE_LENGTH);
      expect({ glyph, parsed: zJoinCodeValue.safeParse(code).success }).toEqual({
        glyph,
        parsed: true,
      });
    }
  });
});

describe("zJoinCodePathParam", () => {
  it("normalizes the path parameter, so the hyphenated URL reaches the same row", () => {
    expect(zJoinCodePathParam.parse({ code: "kp7q-4wmx" })).toEqual({ code: "KP7Q4WMX" });
  });
});

describe("zCreateJoinCodeBody", () => {
  it("defaults to a week", () => {
    expect(zCreateJoinCodeBody.parse({})).toEqual({ expiresIn: "7d" });
  });

  it("rejects an expiry that is not a preset", () => {
    expect(zCreateJoinCodeBody.safeParse({ expiresIn: "14d" }).success).toBe(false);
  });
});
