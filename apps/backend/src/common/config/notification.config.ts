import { registerAs } from "@nestjs/config";

export default registerAs("notification", () => ({
  unsubscribeSecret: process.env.NOTIFICATION_UNSUBSCRIBE_SECRET,
}));
