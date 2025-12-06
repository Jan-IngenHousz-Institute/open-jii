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
        prepareCmd: `echo '{"app":"backend","version":"\${nextRelease.version}","tag":"backend-v\${nextRelease.version}","changelog":"\${nextRelease.notes}"}' > ../../release-summary-backend.json`,
      },
    ],
  ],
};
