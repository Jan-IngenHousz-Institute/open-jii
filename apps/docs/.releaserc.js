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
        prepareCmd: `echo '{"app":"docs","version":"\${nextRelease.version}","tag":"docs-v\${nextRelease.version}","changelog":"\${nextRelease.notes}"}' > ../../release-summary-docs.json`,
      },
    ],
  ],
};
