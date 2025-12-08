/**
 * Semantic release configuration for Backend app
 * Tag format: backend-vX.Y.Z
 */
import baseConfig from '../../.releaserc.js';

export default {
  ...baseConfig,
  extends: 'semantic-release-monorepo',
  tagFormat: 'backend-v${version}',
  plugins: [
    ...baseConfig.plugins,
    [
      '@semantic-release/exec',
      {
        // Generate release summary JSON for deployment workflows
        prepareCmd: `jq -n --arg app "backend" --arg version "\${nextRelease.version}" --arg tag "backend-v\${nextRelease.version}" --arg changelog "\${nextRelease.notes}" '{app: $app, version: $version, tag: $tag, changelog: $changelog}' > ../../release-summary-backend.json`,
      },
    ],
  ],
};
