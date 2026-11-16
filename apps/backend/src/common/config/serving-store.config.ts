import { registerAs } from "@nestjs/config";

/**
 * The serving store's address, the read-only user the backend reads with, and the user the outbox
 * copies annotations and metadata sheets with. An environment without a store, such as DR, leaves
 * the URL unset and reads experiment data from the warehouse; one without the copier owes the store
 * no copies.
 */
export default registerAs("servingStore", () => ({
  url: process.env.SERVING_STORE_URL,
  username: process.env.SERVING_STORE_USERNAME,
  password: process.env.SERVING_STORE_PASSWORD,
  copierUsername: process.env.SERVING_STORE_COPIER_USERNAME,
  copierPassword: process.env.SERVING_STORE_COPIER_PASSWORD,
}));
