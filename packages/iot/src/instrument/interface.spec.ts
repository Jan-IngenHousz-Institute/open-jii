import { describe, expect, it } from "vitest";

import { handshakeMatches } from "./interface";

describe("handshakeMatches", () => {
  it("matches a handshake that appears anywhere in the reply, whatever its case", () => {
    expect(handshakeMatches("KIPRIM,DC310S,25011669,FV:V5.2.0", "kiprim")).toBe(true);
    expect(handshakeMatches("hello\r\npar_ref", "Par_REF")).toBe(true);
  });

  it("ignores whitespace around the reply and around the handshake", () => {
    expect(handshakeMatches("  raw REPL; CTRL-B to exit  ", " raw REPL ")).toBe(true);
  });

  it("refuses a handshake the reply does not contain, so two roles on one class stay apart", () => {
    expect(handshakeMatches("hello\r\nEmit_LED", "Par_REF")).toBe(false);
  });
});
