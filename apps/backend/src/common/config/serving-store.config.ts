import { registerAs } from "@nestjs/config";

/**
 * The serving store's address and the read-only user the backend reads with. An environment
 * without a store, such as DR, leaves the URL unset and reads experiment data from the warehouse.
 */
export default registerAs("servingStore", () => ({
  url: process.env.SERVING_STORE_URL,
  username: process.env.SERVING_STORE_USERNAME,
  password: process.env.SERVING_STORE_PASSWORD,
}));
