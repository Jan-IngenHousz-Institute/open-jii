import type { CreateProtocolRequestBody } from "@repo/api/domains/protocol/protocol.schema";

/**
 * Form-values twin of `CreateProtocolRequestBody`. react-hook-form's utility
 * types (`DeepPartial`, `FieldErrors`) cannot recurse into the contract's
 * recursive `JsonValue`, so forms carry `code` as `unknown`; the step schemas
 * (built from the real contract schema) still validate it before submit.
 */
export type NewProtocolFormValues = Omit<CreateProtocolRequestBody, "code"> & {
  code: unknown;
};
