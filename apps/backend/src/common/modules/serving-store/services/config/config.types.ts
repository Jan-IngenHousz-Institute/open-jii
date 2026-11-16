import { z } from "zod";

export interface StoreCredentials {
  username: string;
  password: string;
}

export interface ServingStoreConfig extends StoreCredentials {
  url: string;
  /** The outbox's copier; null where no copies are owed to the store. */
  copier: StoreCredentials | null;
}

const zCredentials = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const servingStoreConfigSchema = zCredentials.extend({
  url: z.string().url(),
  copier: zCredentials.nullable(),
});
