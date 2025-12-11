/**
 * Semantic release configuration for Docs app
 * Tag format: docs-vX.Y.Z
 */
import baseConfig from '../../.releaserc.js';

export default {
  ...baseConfig,
  extends: 'semantic-release-monorepo',
  tagFormat: 'docs-v${version}',
  plugins: [
    ...baseConfig.plugins,
    [
      '@semantic-release/exec',
      {
        // Generate release summary JSON for deployment workflows
        prepareCmd: `printf '%s' "\${nextRelease.notes}" | jq -Rs --arg app "docs" --arg version "\${nextRelease.version}" --arg tag "docs-v\${nextRelease.version}" '{app: $app, version: $version, tag: $tag, changelog: .}' > ../../release-summary-docs.json`,
      },
    ],
  ],
};
