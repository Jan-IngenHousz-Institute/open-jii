/**
 * Semantic release configuration for Status app
 * Tag format: status-vX.Y.Z
 */
import {
  analyzeCommits,
  fail,
  generateNotes,
  success,
} from "@open-jii/release-tools/monorepo-deps.js";

import baseConfig from "../../.releaserc.js";

export default {
  ...baseConfig,
  tagFormat: "status-v${version}",
  analyzeCommits,
  generateNotes,
  success,
  fail,
  plugins: [
    ...baseConfig.plugins,
    [
      "@semantic-release/exec",
      {
        // Generate release summary JSON using POSIX sh and semantic-release env vars
        prepareCmd:
          'printf \'%s\' "$SEMANTIC_RELEASE_NEXT_RELEASE_NOTES" | jq -Rs --arg app "status" --arg version "$SEMANTIC_RELEASE_NEXT_RELEASE_VERSION" --arg tag "status-v$SEMANTIC_RELEASE_NEXT_RELEASE_VERSION" \'{app: $app, version: $version, tag: $tag, changelog: .}\' > ../../release-summary-status.json',
      },
    ],
  ],
};
