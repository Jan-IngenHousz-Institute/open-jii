/**
 * Base semantic-release configuration for Open-JII monorepo
 * This config is extended by per-app configurations
 */
export default {
  branches: ["main"],
  plugins: [
    // Analyze commits to determine version bump
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "revert", release: "patch" },
          { type: "docs", release: false },
          { type: "style", release: false },
          { type: "chore", release: false },
          { type: "refactor", release: false },
          { type: "test", release: false },
          { type: "build", release: false },
          { type: "ci", release: false },
          { breaking: true, release: "major" },
        ],
      },
    ],
    // Generate beautiful changelogs (Turborepo-style)
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "✨ Features", hidden: false },
            { type: "fix", section: "🐛 Bug Fixes", hidden: false },
            { type: "perf", section: "⚡ Performance Improvements", hidden: false },
            { type: "revert", section: "⏪ Reverts", hidden: false },
            { type: "docs", section: "📚 Documentation", hidden: false },
            { type: "style", section: "💄 Styles", hidden: false },
            { type: "chore", section: "🔧 Miscellaneous Chores", hidden: false },
            { type: "refactor", section: "♻️ Code Refactoring", hidden: false },
            { type: "test", section: "✅ Tests", hidden: false },
            { type: "build", section: "📦 Build System", hidden: false },
            { type: "ci", section: "🔁 Continuous Integration", hidden: false },
          ],
        },
      },
    ],
    // Create GitHub releases with changelogs
    [
      "@semantic-release/github",
      {
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
