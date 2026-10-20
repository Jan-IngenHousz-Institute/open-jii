import { z } from "zod";

import { zPublishDatasetBody } from "@repo/api/domains/dataset/dataset.schema";

/** The publish body plus Check's gate, which is not sent: the server recomputes the floor. */
export const zPublishDatasetForm = zPublishDatasetBody.extend({
  floorComplete: z.literal(true),
});

export type PublishDatasetForm = z.infer<typeof zPublishDatasetForm>;

export const scopeSchema = z.object({});

export const curateSchema = zPublishDatasetForm.pick({ excludedReadings: true });

export const describeSchema = zPublishDatasetForm.pick({
  title: true,
  description: true,
  authors: true,
  limitations: true,
});

export const licenseSchema = zPublishDatasetForm.pick({
  license: true,
  rightToPublish: true,
  access: true,
  embargoUntil: true,
});

export const checkSchema = zPublishDatasetForm.pick({ floorComplete: true });

export const freezeSchema = z.object({});
