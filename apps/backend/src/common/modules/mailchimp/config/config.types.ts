import { z } from "zod";

export type MailchimpCommunityKind = "group" | "tag";

export interface MailchimpConfig {
  apiKey: string;
  serverPrefix: string;
  audienceId: string;
  community: {
    kind: MailchimpCommunityKind;
    id: string;
    name: string;
  };
}

export const mailchimpConfigSchema = z.object({
  apiKey: z.string().min(1),
  serverPrefix: z.string().min(1),
  audienceId: z.string().min(1),
  community: z.object({
    kind: z.enum(["group", "tag"]),
    id: z.string().min(1),
    name: z.string().min(1),
  }),
});
