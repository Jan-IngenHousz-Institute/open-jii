/**
 * Trust boundary for macro-constructed device commands.
 *
 * A macro runs in a sandbox and is untrusted; a "command"/"protocol" value it
 * returns is a forgeable request, not a trust signal. This validator runs on the
 * trusted host before any dispatch: it re-checks shape, enforces a per-family
 * command whitelist, default-denies dangerous writers, bounds size, and returns
 * the concrete command to send. The raw artifact must never reach a device
 * un-validated.
 */
import { MULTISPEQ_COMMANDS_V2, MULTISPEQ_CONSOLE } from "../driver/multispeq/commands";
import type { SensorFamily } from "./families";
import { isSensorFamily } from "./families";

export type CommandFamily = SensorFamily;

export interface ValidateCommandOptions {
  /**
   * Host-resolved device family, the trust anchor. When set, an artifact
   * claiming a different family is rejected rather than allowed to opt out of
   * a stricter whitelist. The artifact's own `family` is used only when the
   * host provides none.
   */
  family?: CommandFamily;
  /** Per-workbook capability gating dangerous device writes (calibration, etc.). */
  allowDeviceWrites?: boolean;
  /** Max content/serialized size in bytes (default 64 KiB). */
  maxContentBytes?: number;
  /** Max protocol instruction blocks (default 256). */
  maxBlocks?: number;
}

export type ValidatedCommand =
  | { ok: true; command: string | Record<string, unknown>[]; family: CommandFamily }
  | { ok: false; reason: string };

const DEFAULT_MAX_CONTENT_BYTES = 64 * 1024;
const DEFAULT_MAX_BLOCKS = 256;

// MultispeQ console commands that change device state and must stay opt-in.
const DANGEROUS_MULTISPEQ: ReadonlySet<string> = new Set([
  "digital_write",
  "configure_bluetooth",
  "upgrade",
  "reset",
  "reboot",
  "readonce",
  "sleep",
  "set_serial",
  "set_dac",
  "set_date",
  "set_device_info",
]);

const MULTISPEQ_ALLOWED: ReadonlySet<string> = new Set<string>([
  ...Object.values(MULTISPEQ_COMMANDS_V2),
  ...Object.values(MULTISPEQ_CONSOLE),
]);

// Base token of a console command: the part before the `+` arg separator or
// whitespace, with trailing digits stripped (e.g. `light5` -> `light`). Numeric
// command aliases (e.g. `1053`) keep their digits.
function leadingToken(content: string): string {
  const head = content.trim().split(/[+\s]/)[0].toLowerCase();
  const base = head.replace(/\d+$/, "");
  return base || head;
}

function isDangerousMultispeq(token: string): boolean {
  return (
    DANGEROUS_MULTISPEQ.has(token) || token.startsWith("set_") || token.startsWith("calibrate_")
  );
}

function byteLength(value: string): number {
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(value).length : value.length;
}

function resolveFamily(
  artifactFamily: unknown,
  hostFamily: CommandFamily | undefined,
): { ok: true; family: CommandFamily } | { ok: false; reason: string } {
  if (artifactFamily !== undefined && !isSensorFamily(artifactFamily)) {
    const shown = typeof artifactFamily === "string" ? artifactFamily : typeof artifactFamily;
    return { ok: false, reason: `Unknown device family: ${shown}` };
  }
  if (hostFamily && artifactFamily && artifactFamily !== hostFamily) {
    return {
      ok: false,
      reason: `Artifact family "${artifactFamily as string}" does not match device family "${hostFamily}"`,
    };
  }
  return {
    ok: true,
    family: hostFamily ?? artifactFamily ?? "multispeq",
  };
}

/**
 * Validate a macro-returned artifact and return the concrete command to dispatch.
 * The input is treated as untrusted; structure is re-checked here, not assumed.
 */
export function validateCommandArtifact(
  artifact: unknown,
  opts: ValidateCommandOptions = {},
): ValidatedCommand {
  const maxBytes = opts.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
  const maxBlocks = opts.maxBlocks ?? DEFAULT_MAX_BLOCKS;

  if (artifact == null || typeof artifact !== "object") {
    return { ok: false, reason: "Artifact must be an object" };
  }
  const a = artifact as Record<string, unknown>;
  if (a.version !== 1) {
    return { ok: false, reason: "Unsupported artifact version" };
  }

  const resolved = resolveFamily(a.family, opts.family);
  if (!resolved.ok) {
    return resolved;
  }
  const family = resolved.family;

  if (a.__ojArtifact === "command") {
    const content = a.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, reason: "Command content must be a non-empty string" };
    }
    if (byteLength(content) > maxBytes) {
      return { ok: false, reason: "Command content exceeds size limit" };
    }
    if (family === "multispeq") {
      const trimmed = content.trim();
      const token = leadingToken(content);
      const known = MULTISPEQ_ALLOWED.has(trimmed) || MULTISPEQ_ALLOWED.has(token);
      if (!known) {
        return { ok: false, reason: `Unknown MultispeQ command: ${token}` };
      }
      if (isDangerousMultispeq(token) && !opts.allowDeviceWrites) {
        return { ok: false, reason: `Command "${token}" requires allowDeviceWrites` };
      }
    }
    // Return the parsed/whitelisted command, never an unchecked passthrough.
    return { ok: true, command: content.trim(), family };
  }

  if (a.__ojArtifact === "protocol") {
    const code = a.code;
    if (!Array.isArray(code) || code.length === 0) {
      return { ok: false, reason: "Protocol code must be a non-empty array" };
    }
    if (code.length > maxBlocks) {
      return { ok: false, reason: "Protocol exceeds block limit" };
    }
    if (!code.every((b) => b != null && typeof b === "object" && !Array.isArray(b))) {
      return { ok: false, reason: "Protocol blocks must be objects" };
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(code);
    } catch {
      return { ok: false, reason: "Protocol is not serializable" };
    }
    if (byteLength(serialized) > maxBytes) {
      return { ok: false, reason: "Protocol exceeds size limit" };
    }
    return { ok: true, command: code as Record<string, unknown>[], family };
  }

  return { ok: false, reason: "Unknown artifact kind" };
}
