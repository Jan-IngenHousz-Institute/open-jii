/**
 * Semantic release configuration for Web app
 * Tag format: web-vX.Y.Z
 */
import baseConfig from '../../.releaserc.js';

export default {
  ...baseConfig,
  extends: 'semantic-release-monorepo',
  tagFormat: 'web-v${version}',
  plugins: [
    ...baseConfig.plugins,
    [
      '@semantic-release/exec',
      {
        // Generate release summary JSON using POSIX sh and semantic-release env vars
        prepareCmd: "printf '%s' \"$SEMANTIC_RELEASE_NEXT_RELEASE_NOTES\" | jq -Rs --arg app \"web\" --arg version \"$SEMANTIC_RELEASE_NEXT_RELEASE_VERSION\" --arg tag \"web-v$SEMANTIC_RELEASE_NEXT_RELEASE_VERSION\" '{app: $app, version: $version, tag: $tag, changelog: .}' > ../../release-summary-web.json",
      },
    ],
  ],
};
