export default {
  default: {},
  imageOptimization: {
    // OpenNext's default passes `--arch`, which npm ignores, so the x64 CI runner shipped x64
    // sharp and every image went out unoptimized. The CPU must match the image Lambda's
    // `lambda_architecture` in infrastructure/modules/opennext, and the version must match the
    // sharp the lockfile resolves for next.
    install: {
      packages: ["sharp@0.35.5"],
      os: "linux",
      libc: "glibc",
      additionalArgs: "--cpu=arm64",
    },
  },
  buildCommand: "exit 0",
  buildOutputPath: ".",
  appPath: ".",
  packageJsonPath: "../../",
};
