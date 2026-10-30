import { oc } from "@orpc/contract";
import { z } from "zod";

export const zPlatformAdminPerson = z.object({
  id: z.string().uuid(),
  name: z.string(),
  grantedAt: z.string().datetime().nullable(),
});

export const platformAdminContract = {
  getPlatformAdminAccess: oc
    .route({ method: "GET", path: "/api/v1/platform-admins/access", successStatus: 200 })
    .input(z.object({}))
    .output(z.object({ isPlatformAdmin: z.boolean() })),
  listPlatformAdmins: oc
    .route({ method: "GET", path: "/api/v1/platform-admins", successStatus: 200 })
    .input(z.object({}))
    .output(z.array(zPlatformAdminPerson)),
};
