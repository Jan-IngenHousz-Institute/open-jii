import { z } from "zod";
import type { UploadIdentity } from "~/features/recent-measurements/services/outbox";

import { getCachedSession } from "./session-cache";

const cachedIdentity = z.object({
  user: z.object({ id: z.string().min(1), isAnonymous: z.boolean().default(false) }),
  session: z.object({ expiresAt: z.coerce.date() }),
});

export function getLocalUploadIdentity(): UploadIdentity | null {
  try {
    const parsed = cachedIdentity.safeParse(getCachedSession());
    if (!parsed.success || parsed.data.session.expiresAt.getTime() <= Date.now()) return null;
    return { userId: parsed.data.user.id, isGuest: parsed.data.user.isAnonymous };
  } catch {
    return null;
  }
}
