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
        prepareCmd: `echo '{"app":"mobile","version":"\${nextRelease.version}","tag":"mobile-v\${nextRelease.version}","changelog":"\${nextRelease.notes}"}' > ../../release-summary-mobile.json`,
      },
    ],
  ],
};
