# 🚀 Release Automation Setup

## Quick Start

This release automation is **ready to use** out of the box! Just follow these steps to get started.

---

## ✅ Prerequisites

The system requires:
- ✅ Node.js v22+ (already required)
- ✅ pnpm (already installed)
- ✅ Git (already have)
- ✅ GitHub Actions (already configured)

---

## 📦 Installation

### 1. Install semantic-release Dependencies

```bash
cd tools/release
pnpm install
```

This installs:
- `semantic-release` - Core versioning engine
- `@semantic-release/github` - GitHub Releases integration
- `conventional-changelog-conventionalcommits` - Changelog generator
- `semantic-release-monorepo` - Monorepo support

### 2. Verify Configuration Files

Check that these files exist (they should already be there):

```
✅ .releaserc.js                      # Base config
✅ apps/mobile/.releaserc.js         # Mobile config
✅ apps/web/.releaserc.js            # Web config
✅ apps/backend/.releaserc.js        # Backend config
✅ apps/docs/.releaserc.js           # Docs config
✅ tools/release/package.json        # Dependencies
✅ .github/workflows/release.yml     # Release workflow
✅ .github/workflows/pr.yml          # PR preview (updated)
✅ .github/actions/semantic-release/ # Release action
```

---

## 🧪 Test the System

### Option 1: Test PR Preview (Recommended)

1. **Create a test branch**:
   ```bash
   git checkout -b test/release-automation
   ```

2. **Make a test change** to mobile app:
   ```bash
   echo "// Test comment" >> apps/mobile/index.tsx
   git add apps/mobile/index.tsx
   git commit -m "feat(mobile): test release automation"
   git push origin test/release-automation
   ```

3. **Open a PR** to `main`
4. **Check the PR** - You should see a comment like:
   ```
   🔍 Release Preview
   
   ✨ Merging this PR will create the following releases:
   
   ### mobile
   - Version: v1.0.13
   - Tag: mobile-v1.0.13
   ```

### Option 2: Test Full Release

1. **Merge the test PR** to `main`
2. **Go to Actions tab** in GitHub
3. **Watch the Release workflow** run
4. **Check Releases page** for new release

---

## 🔧 Configuration Options

### Customize Changelog Sections

Edit `.releaserc.js` to modify emoji and section names:

```javascript
{
  types: [
    { type: 'feat', section: '✨ Features' },
    { type: 'fix', section: '🐛 Bug Fixes' },
    // Add more...
  ]
}
```

### Change Release Rules

Modify version bump rules in `.releaserc.js`:

```javascript
releaseRules: [
  { type: 'feat', release: 'minor' },    // 1.0.0 → 1.1.0
  { type: 'fix', release: 'patch' },     // 1.0.0 → 1.0.1
  { breaking: true, release: 'major' },  // 1.0.0 → 2.0.0
]
```

### Add New Apps

To add a new app (e.g., `apps/analytics`):

1. **Create config file** `apps/analytics/.releaserc.js`:
   ```javascript
   import baseConfig from '../../.releaserc.js';

   export default {
     ...baseConfig,
     extends: 'semantic-release-monorepo',
     tagFormat: 'analytics-v${version}',
     plugins: [
       ...baseConfig.plugins,
       ['@semantic-release/exec', {
         prepareCmd: `echo '{"app":"analytics","version":"\${nextRelease.version}"}' > ../../release-summary-analytics.json`,
       }],
     ],
   };
   ```

2. **Add deploy job** to `.github/workflows/release.yml`:
   ```yaml
   deploy-analytics:
     needs: release
     if: contains(needs.release.outputs.releases_created, 'analytics')
     steps:
       # Your deployment steps
   ```

---

## 🚨 Troubleshooting

### Error: "npm: command not found"

The action needs npm to install semantic-release globally. If using pure pnpm environment:

```yaml
# Add to workflow before semantic-release action
- name: Enable npm
  run: corepack enable npm
```

### Error: "No commits found"

**Cause**: Not enough git history

**Solution**: Ensure `fetch-depth: 0` in checkout:
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # This is critical!
```

### Release not created despite conventional commits

**Check**:
1. Commits use correct format: `feat(mobile): ...`
2. App scope matches directory name
3. App has `.releaserc.js` file
4. Previous release tag exists (for first release, create manually: `mobile-v1.0.0`)

### PR Preview not showing

**Check**:
1. PR targets `main` branch
2. Workflow has `pull-requests: write` permission
3. At least one `feat:` or `fix:` commit exists

---

## 📚 Next Steps

1. **Read the full guide**: `docs/RELEASES.md`
2. **Test the system** with a small PR
3. **Connect deployments** (replace placeholder jobs)
4. **Train team** on conventional commits

---

## ✅ System Health Check

Run this checklist to verify everything is ready:

- [ ] `tools/release/node_modules` exists (ran `pnpm install`)
- [ ] `.releaserc.js` files exist for all apps
- [ ] GitHub Actions has write permissions for releases
- [ ] Team knows conventional commit format
- [ ] PR workflow includes preview job
- [ ] Release workflow includes deploy jobs (placeholders OK)
- [ ] Created initial tags: `mobile-v1.0.12`, `web-v0.1.0`, etc. (optional)

---

## 🎉 You're Ready!

The release automation is now **fully configured** and **ready to use**. Just:

1. Write conventional commits
2. Open PRs
3. Review preview
4. Merge to main
5. Watch releases happen automatically! 🚀

For questions, see `docs/RELEASES.md` or ask the team.
