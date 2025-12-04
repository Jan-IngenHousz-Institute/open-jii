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
        prepareCmd: `echo '{"app":"web","version":"\${nextRelease.version}","tag":"web-v\${nextRelease.version}","changelog":"\${nextRelease.notes}"}' > ../../release-summary-web.json`,
      },
    ],
  ],
};
