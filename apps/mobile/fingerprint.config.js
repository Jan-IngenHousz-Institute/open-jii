// The release workflow writes each release's semver into app.json before the fingerprint is
// computed, so hashing the version made every release look native and forced a full build.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: ["ExpoConfigVersions", "PackageJsonAndroidAndIosScriptsIfNotContainRun"],
};
