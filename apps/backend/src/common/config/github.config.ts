import { registerAs } from "@nestjs/config";

/**
 * GitHub configuration: the firmware repository per device family, and an
 * optional token. The repositories are public, so the token only raises the
 * anonymous rate limit.
 */
export default registerAs("github", () => ({
  token: process.env.GITHUB_TOKEN,
  firmwareRepositories: {
    ambyte: process.env.FIRMWARE_REPO_AMBYTE,
    ambit: process.env.FIRMWARE_REPO_AMBIT,
    minipar: process.env.FIRMWARE_REPO_MINIPAR,
  },
}));
