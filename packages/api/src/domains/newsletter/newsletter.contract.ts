import { oc } from "@orpc/contract";

import {
  zNewsletterStatusResponse,
  zNewsletterSubscribeBody,
  zNewsletterSubscribeResponse,
} from "./newsletter.schema";

export const newsletterContract = {
  subscribe: oc
    .route({ method: "POST", path: "/api/v1/newsletter/subscribe", successStatus: 200 })
    .input(zNewsletterSubscribeBody)
    .output(zNewsletterSubscribeResponse),
  getStatus: oc
    .route({ method: "GET", path: "/api/v1/newsletter/status", successStatus: 200 })
    .output(zNewsletterStatusResponse),
  subscribeDirect: oc
    .route({ method: "POST", path: "/api/v1/newsletter/subscription", successStatus: 200 })
    .output(zNewsletterStatusResponse),
  unsubscribe: oc
    .route({ method: "DELETE", path: "/api/v1/newsletter/subscription", successStatus: 200 })
    .output(zNewsletterStatusResponse),
};
