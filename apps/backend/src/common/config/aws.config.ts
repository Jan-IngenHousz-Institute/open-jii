import { registerAs } from "@nestjs/config";

/**
 * AWS configuration values from environment variables
 */
export default registerAs("aws", () => ({
  region: process.env.AWS_REGION,
  location: {
    placeIndexName: process.env.AWS_LOCATION_PLACE_INDEX_NAME,
  },
}));
