import { describe, it, expect } from "vitest";

import { validateCommandArtifact } from "./command-validator";

const cmd = (content: string, extra: Record<string, unknown> = {}) => ({
  __ojArtifact: "command" as const,
  version: 1 as const,
  content,
  ...extra,
});

describe("validateCommandArtifact - command", () => {
  it("accepts a whitelisted MultispeQ console command", () => {
    const r = validateCommandArtifact(cmd("battery"));
    expect(r).toEqual({ ok: true, command: "battery", family: "multispeq" });
  });

  it("accepts a console control sequence", () => {
    const r = validateCommandArtifact(cmd("s+"));
    expect(r.ok).toBe(true);
  });

  it("accepts a parameterised command (light5)", () => {
    const r = validateCommandArtifact(cmd("light5"));
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown command", () => {
    const r = validateCommandArtifact(cmd("rm -rf /"));
    expect(r.ok).toBe(false);
  });

  it("default-denies a dangerous writer (set_dac) without allowDeviceWrites", () => {
    const r = validateCommandArtifact(cmd("set_dac+1+128"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/allowDeviceWrites/);
  });

  it("allows a dangerous writer when allowDeviceWrites is set", () => {
    const r = validateCommandArtifact(cmd("set_dac+1+128"), { allowDeviceWrites: true });
    expect(r.ok).toBe(true);
  });

  it("default-denies digital_write, configure_bluetooth, upgrade, reset", () => {
    for (const c of ["digital_write+5+1", "configure_bluetooth+x", "upgrade", "reset", "reboot"]) {
      expect(validateCommandArtifact(cmd(c)).ok).toBe(false);
    }
  });

  it("default-denies any set_* / calibrate_* writer", () => {
    expect(validateCommandArtifact(cmd("set_colorcal1+1")).ok).toBe(false);
    expect(validateCommandArtifact(cmd("calibrate_leds")).ok).toBe(false);
  });

  it("rejects a forged tag with a wrong version", () => {
    const r = validateCommandArtifact({ __ojArtifact: "command", version: 99, content: "battery" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown device family", () => {
    const r = validateCommandArtifact(cmd("battery", { family: "evil-device" }));
    expect(r.ok).toBe(false);
  });

  it("rejects content over the size limit", () => {
    const r = validateCommandArtifact(cmd("battery" + "x".repeat(70_000)));
    expect(r.ok).toBe(false);
  });

  it("does not apply the MultispeQ whitelist to the generic family", () => {
    const r = validateCommandArtifact(cmd("anything-goes", { family: "generic" }));
    expect(r).toEqual({ ok: true, command: "anything-goes", family: "generic" });
  });
});

describe("validateCommandArtifact - protocol", () => {
  const proto = (code: unknown, extra: Record<string, unknown> = {}) => ({
    __ojArtifact: "protocol" as const,
    version: 1 as const,
    code,
    ...extra,
  });

  it("accepts a non-empty array of instruction blocks", () => {
    const r = validateCommandArtifact(proto([{ _protocol_set_: [{ pulses: [10] }] }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Array.isArray(r.command)).toBe(true);
  });

  it("rejects an empty array", () => {
    expect(validateCommandArtifact(proto([])).ok).toBe(false);
  });

  it("rejects a non-array", () => {
    expect(validateCommandArtifact(proto({ not: "array" })).ok).toBe(false);
  });

  it("rejects blocks that are not objects", () => {
    expect(validateCommandArtifact(proto([1, 2, 3])).ok).toBe(false);
  });

  it("rejects too many blocks", () => {
    const many = Array.from({ length: 300 }, () => ({ x: 1 }));
    expect(validateCommandArtifact(proto(many), { maxBlocks: 256 }).ok).toBe(false);
  });
});

describe("validateCommandArtifact - structural", () => {
  it("rejects non-objects", () => {
    expect(validateCommandArtifact(null).ok).toBe(false);
    expect(validateCommandArtifact("battery").ok).toBe(false);
  });

  it("rejects an unknown artifact kind", () => {
    expect(validateCommandArtifact({ __ojArtifact: "shell", version: 1 }).ok).toBe(false);
  });
});
