import { z } from "zod";

/**
 * Devices are absent on purpose: one owns a live AWS IoT Thing and certificate
 * provisioned against its organization, so moving the row would leave the cloud
 * side behind. They are removed and re-created instead.
 */
export const zTransferableResourceType = z.enum(["experiment", "macro", "protocol", "workbook"]);

export const zTransferResourcePathParams = z.object({
  resourceType: zTransferableResourceType,
  id: z.string().uuid().describe("ID of the resource being transferred"),
});

export const zTransferResourceBody = z.object({
  targetOrganizationId: z
    .string()
    .uuid()
    .describe("Organization to move the resource to; the caller must be a member of it"),
});

/**
 * The resource's new home. Nothing else changes — visibility, embargo, data and
 * user/organization grants all survive the move — so there is nothing else to
 * report back.
 */
export const zTransferResourceResponse = z.object({
  resourceType: zTransferableResourceType,
  resourceId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export type TransferableResourceType = z.infer<typeof zTransferableResourceType>;
export type TransferResourceBody = z.infer<typeof zTransferResourceBody>;
export type TransferResourceResponse = z.infer<typeof zTransferResourceResponse>;
