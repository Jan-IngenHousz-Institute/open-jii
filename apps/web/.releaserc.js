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
        // Generate release summary JSON for deployment workflows
        prepareCmd: `jq -n --arg app "web" --arg version "\${nextRelease.version}" --arg tag "web-v\${nextRelease.version}" --arg changelog "\${nextRelease.notes}" '{app: $app, version: $version, tag: $tag, changelog: $changelog}' > ../../release-summary-web.json`,
      },
    ],
  ],
};
