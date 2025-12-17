/**
 * Semantic release configuration for Mobile app
 * Tag format: mobile-vX.Y.Z
 */
import baseConfig from '../../.releaserc.js';

export default {
  ...baseConfig,
  extends: 'semantic-release-monorepo',
  tagFormat: 'mobile-v${version}',
  plugins: [
    ...baseConfig.plugins,
    [
      '@semantic-release/exec',
      {
        // Generate release summary JSON using POSIX sh and semantic-release env vars
        prepareCmd: "printf '%s' \"$SEMANTIC_RELEASE_NEXT_RELEASE_NOTES\" | jq -Rs --arg app \"mobile\" --arg version \"$SEMANTIC_RELEASE_NEXT_RELEASE_VERSION\" --arg tag \"mobile-v$SEMANTIC_RELEASE_NEXT_RELEASE_VERSION\" '{app: $app, version: $version, tag: $tag, changelog: .}' > ../../release-summary-mobile.json",
      },
    ],
  ],
};
