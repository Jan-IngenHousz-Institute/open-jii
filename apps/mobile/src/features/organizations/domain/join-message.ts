import { zCreateOrganizationJoinRequestBody } from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";

// Read off the contract so the counter and the server cannot drift apart.
export const JOIN_MESSAGE_MAX_LENGTH =
  zCreateOrganizationJoinRequestBody.shape.message.unwrap().maxLength ?? 250;

export function normalizeJoinMessage(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}
