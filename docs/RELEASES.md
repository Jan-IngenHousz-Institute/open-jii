# 🚀 Release Automation Guide

## Overview

Open-JII uses **automated semantic versioning** with conventional commits to create beautiful, Turborepo-style releases for each app independently. This guide explains how the release system works and how to use it.

---

## 🎯 Key Features

- ✅ **Automated versioning** - Semantic versioning based on conventional commits
- ✅ **Beautiful changelogs** - Categorized, emoji-rich release notes (like Turborepo)
- ✅ **Independent app releases** - Each app (mobile, web, backend, docs) versioned separately
- ✅ **PR preview** - See what will be released before merging
- ✅ **No file modifications** - Versions live only in git tags and GitHub Releases
- ✅ **Deployment integration** - Releases trigger deployment workflows automatically

---

## 📋 How It Works

### 1. Development Flow

```
Feature branch → Conventional commits → Pull Request → Review
                                            ↓
                                    PR Preview Comment
                                    (shows upcoming release)
                                            ↓
                                    Merge to main
                                            ↓
                            Release workflow triggers automatically
```

### 2. Release Workflow Steps

1. **Detect** - Which apps changed?
2. **Build** - Ensure everything compiles
3. **Release** - Create versions, changelogs, GitHub Releases
4. **Deploy** - Trigger deployment per app

---

## ✍️ Conventional Commit Format

### Structure

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types & Version Bumps

| Type | Version Impact | Example | Description |
|------|---------------|---------|-------------|
| `feat` | **MINOR** ⬆️ | 1.0.0 → **1.1.0** | New feature |
| `fix` | **PATCH** ⬆️ | 1.0.0 → **1.0.1** | Bug fix |
| `perf` | **PATCH** ⬆️ | 1.0.0 → **1.0.1** | Performance improvement |
| `BREAKING CHANGE` | **MAJOR** ⬆️ | 1.0.0 → **2.0.0** | Breaking API change |
| `docs` | No release | - | Documentation only |
| `style` | No release | - | Code formatting |
| `refactor` | No release | - | Code restructuring |
| `test` | No release | - | Adding tests |
| `chore` | No release | - | Maintenance tasks |
| `ci` | No release | - | CI/CD changes |
| `build` | No release | - | Build system changes |

### Scopes

Use the app name as scope:
- `mobile` - Mobile app changes
- `web` - Web app changes
- `backend` - Backend API changes
- `docs` - Documentation site changes

### Examples

#### ✨ New Feature (Minor)
```bash
git commit -m "feat(mobile): add bluetooth device pairing

Implements BLE scanning and connection management.
Users can now pair MultispeQ devices via Bluetooth.

Closes #123"
```

#### 🐛 Bug Fix (Patch)
```bash
git commit -m "fix(web): resolve login timeout issue

Increased timeout from 5s to 10s and added retry logic.

Fixes #456"
```

#### 💥 Breaking Change (Major)
```bash
git commit -m "feat(backend): migrate to new authentication API

BREAKING CHANGE: Old auth endpoints /v1/login are removed.
All clients must migrate to /v2/auth/login.
See migration guide in docs/auth-migration.md

Closes #789"
```

#### 📚 Documentation (No Release)
```bash
git commit -m "docs(mobile): update setup guide for new developers"
```

#### Multiple Changes
```bash
# Make separate commits for each logical change
git commit -m "feat(mobile): add data export feature"
git commit -m "fix(mobile): resolve crash on startup"
git commit -m "docs(mobile): add export documentation"
```

---

## 🔍 PR Preview Feature

When you open a PR to `main`, the preview job will:

1. Analyze your commits
2. Calculate what releases will be created
3. Post a comment showing:
   - Which apps will be released
   - What versions they'll become
   - What triggered the release

### Example PR Comment

```markdown
## 🔍 Release Preview

✨ Merging this PR will create the following releases:

### mobile
- **Version**: `v1.2.0`
- **Tag**: `mobile-v1.2.0`
- **GitHub Release**: Will be created automatically
- **Deployment**: Will trigger mobile deployment workflow

### backend
- **Version**: `v0.5.1`
- **Tag**: `backend-v0.5.1`
- **GitHub Release**: Will be created automatically
- **Deployment**: Will trigger backend deployment workflow

---
*This is a preview based on your conventional commits. Actual releases will occur when merged to main.*
```

---

## 📦 What Gets Released?

### GitHub Release Format (Turborepo-style)

```markdown
# mobile-v1.2.0

## What's Changed

### ✨ Features
* feat(mobile): add bluetooth device pairing (#234) @username
* feat(mobile): implement offline data sync (#235) @teammate

### 🐛 Bug Fixes
* fix(mobile): resolve crash on Android 13 (#237) @username
* fix(mobile): fix memory leak in sensor readings (#238) @teammate

### ⚡ Performance Improvements
* perf(mobile): optimize data processing speed (#240) @username

### 📚 Documentation
* docs(mobile): update setup guide (#242) @username

### 🔧 Miscellaneous Chores
* chore(mobile): update expo SDK to 51 (#244) @dependabot

**Full Changelog**: mobile-v1.1.0...mobile-v1.2.0
```

### Release Artifacts

Each release includes:
1. **GitHub Release** with changelog
2. **Git tag** (e.g., `mobile-v1.2.0`)
3. **release-summary.json** artifact with metadata:
   ```json
   {
     "app": "mobile",
     "version": "1.2.0",
     "tag": "mobile-v1.2.0",
     "changelog": "..."
   }
   ```

---

## 🚀 Release Process

### Automatic Releases (Normal Flow)

1. **Develop** features/fixes in feature branches
2. **Use conventional commits** for all changes
3. **Open PR** to `main` branch
4. **Review PR preview** comment to see what will be released
5. **Get review** from team members
6. **Merge to main**
7. **Release workflow runs automatically**:
   - Detects changed apps
   - Builds everything
   - Creates releases with changelogs
   - Triggers deployments

### Manual Release Trigger

You can also trigger releases manually:

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Select `main` branch
4. Click **Run workflow** button

---

## 🏷️ Tag Format

Each app has independent tags:

| App | Tag Format | Example |
|-----|-----------|---------|
| Mobile | `mobile-vX.Y.Z` | `mobile-v1.2.0` |
| Web | `web-vX.Y.Z` | `web-v2.3.4` |
| Backend | `backend-vX.Y.Z` | `backend-v0.5.1` |
| Docs | `docs-vX.Y.Z` | `docs-v1.0.0` |

**Benefits**:
- ✅ Independent versioning per app
- ✅ Deploy apps at different cadences
- ✅ Clear separation of concerns
- ✅ Easy rollback per app

---

## 🔧 Integration with Deployments

### How Deployment Works

```
Release Created → GitHub Release Published
      ↓
  Deployment Job Triggered
      ↓
  Downloads release-summary.json
      ↓
  Extracts version, tag, changelog
      ↓
  Runs deployment (EAS, AWS, etc.)
```

### Connecting Your Deployment

Replace the placeholder deploy jobs in `.github/workflows/release.yml`:

```yaml
deploy-mobile:
  name: Deploy Mobile
  needs: release
  if: contains(needs.release.outputs.releases_created, 'mobile')
  steps:
    - name: Download Release Metadata
      uses: actions/download-artifact@v4
      with:
        name: release-metadata
    
    - name: Parse Release Info
      id: release
      run: |
        VERSION=$(jq -r '.version' release-summary-mobile.json)
        echo "version=$VERSION" >> $GITHUB_OUTPUT
    
    - name: Build APK/AAB
      run: |
        # Your EAS build command here
        eas build --platform android --profile production
    
    - name: Upload to Store
      run: |
        # Your store upload command here
```

---

## 🚨 Troubleshooting

### "No release was created"

**Cause**: No versioning commits since last release

**Solution**: Ensure at least one `feat:` or `fix:` commit exists. Commits like `docs:`, `chore:`, `style:` don't trigger releases.

### "Wrong version bump"

**Cause**: Incorrect commit type

**Solution**: Use the right type:
- New feature? → `feat:`
- Bug fix? → `fix:`
- Breaking change? → Add `BREAKING CHANGE:` in commit body

### "Multiple apps changed but only one released"

**Cause**: Commits missing proper scopes

**Solution**:
```bash
# ❌ Wrong - unclear which app
git commit -m "feat: add new feature"

# ✅ Correct - clear app scope
git commit -m "feat(mobile): add new feature"
git commit -m "feat(backend): add supporting API"
```

### "PR preview not showing"

**Cause**: PR not targeting `main` branch or no conventional commits

**Solution**:
- Ensure PR targets `main`
- Use conventional commit format
- Check PR has at least one `feat:` or `fix:` commit

---

## 💡 Best Practices

### 1. Write Clear Commit Messages
```bash
# ❌ Bad
git commit -m "fix stuff"

# ✅ Good  
git commit -m "fix(mobile): resolve crash on Android 13

Added null check for sensor data before processing.

Fixes #456"
```

### 2. Use Appropriate Scopes
```bash
# ✅ App-level changes
git commit -m "feat(mobile): ..."
git commit -m "fix(web): ..."

# ✅ Shared package changes (don't trigger releases)
git commit -m "refactor(api): ..."
git commit -m "chore(database): ..."
```

### 3. Link Issues and PRs
```bash
git commit -m "feat(mobile): add bluetooth support

Implements BLE device scanning and connection.

Closes #123
Related to #124"
```

### 4. Review PR Preview
Always check the PR preview comment to ensure:
- Correct apps are being released
- Version bump is appropriate
- No unexpected releases

### 5. Keep Scopes Consistent
Use these standard scopes:
- `mobile` - Mobile app
- `web` - Web app
- `backend` - Backend API
- `docs` - Documentation site
- `api` - API package
- `auth` - Auth package
- `database` - Database package

---

## 📚 Additional Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
- [AWS Deployment Example](https://github.com/infonl/info-ppaai-app/blob/main/.github/workflows/deploy.yml)

---

## 🙋 Need Help?

- Check existing releases for examples
- Review PR preview comments
- Ask in team chat
- Open an issue for questions

---

## 🎉 Summary

**You now have enterprise-grade release automation** that:
- ✅ Generates Turborepo-style changelogs
- ✅ Versions apps independently  
- ✅ Creates GitHub Releases automatically
- ✅ Shows PR previews before merge
- ✅ Triggers deployments per app
- ✅ Requires zero maintenance

**Just write conventional commits and let the automation handle the rest!** 🚀
