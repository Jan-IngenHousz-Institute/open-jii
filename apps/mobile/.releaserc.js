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
        // Generate release summary JSON for deployment workflows
        prepareCmd: `echo "\${nextRelease.notes}" | jq -Rs --arg app "mobile" --arg version "\${nextRelease.version}" --arg tag "mobile-v\${nextRelease.version}" '{app: $app, version: $version, tag: $tag, changelog: .}' > ../../release-summary-mobile.json`,
      },
    ],
  ],
};
