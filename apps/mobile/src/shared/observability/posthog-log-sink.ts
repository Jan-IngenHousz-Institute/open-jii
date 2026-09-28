import type PostHog from "posthog-react-native";

import type { LogFields, LogSink } from "./logger";

type Attribute = string | number | boolean;

// Log fields are free-form; PostHog's log attributes are scalars, so anything else is serialized.
function attributeOf(value: unknown): Attribute {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "[unserializable]";
  }
}

function attributesOf(fields: LogFields): Record<string, Attribute> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, attributeOf(value)]),
  );
}

/**
 * Ships every log line to PostHog Logs, beside the app's errors and sessions, and reports an error
 * line as an exception. Pass `report: false` for an error that is expected, such as a device
 * dropping mid-scan, so it stays a log line without opening an issue.
 */
export function createPostHogLogSink(
  client: Pick<PostHog, "captureLog" | "captureException">,
  environment: () => string,
): LogSink {
  return {
    write(entry) {
      const { report, ...fields } = entry.fields;
      const attributes = attributesOf(fields);

      client.captureLog({
        body: entry.msg,
        level: entry.level,
        attributes: { ...attributes, ns: entry.ns, environment: environment() },
      });

      if (entry.level !== "error" || report === false) {
        return;
      }
      const cause = fields.err;
      // A message logged without an Error has no stack of its own, so its text names the issue.
      client.captureException(
        cause instanceof Error ? cause : new Error(`[${entry.ns}] ${entry.msg}`),
        {
          ...attributes,
          ns: entry.ns,
          ...(cause instanceof Error ? {} : { $exception_fingerprint: `${entry.ns}:${entry.msg}` }),
        },
      );
    },
  };
}
