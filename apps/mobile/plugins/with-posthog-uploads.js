const withPostHog = require("posthog-react-native/expo");

// PostHog's plugin makes every release build upload its JS source maps and native symbols, and
// fails the build when it cannot. Builds with a PostHog CLI key (EAS) upload; a developer's local
// release build without one stays as it was. Always listed in app.json, so the app's fingerprint
// does not depend on the key.
const withPostHogUploads = (config, props) => {
  if (!process.env.POSTHOG_CLI_API_KEY) {
    return config;
  }
  return withPostHog(config, props);
};

module.exports = withPostHogUploads;
