#!/bin/bash

# Script to bump version in app.json, package.json, and versionCode in app.json
# Usage: ./scripts/bump-version.sh [major|minor|patch|version]
# Example: ./scripts/bump-version.sh patch
# Example: ./scripts/bump-version.sh 1.0.15

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_JSON="$PROJECT_ROOT/app.json"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Function to increment version
increment_version() {
  local version=$1
  local part=$2
  
  IFS='.' read -ra VERSION_PARTS <<< "$version"
  local major=${VERSION_PARTS[0]}
  local minor=${VERSION_PARTS[1]}
  local patch=${VERSION_PARTS[2]}
  
  case $part in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo "Error: Invalid version part. Use major, minor, or patch."
      exit 1
      ;;
  esac
  
  echo "$major.$minor.$patch"
}

# Get current version from package.json
get_current_version() {
  node -p "require('$PACKAGE_JSON').version"
}

# Get current versionCode from app.json
get_current_version_code() {
  node -p "require('$APP_JSON').expo.android.versionCode"
}

# Update version in package.json
update_package_version() {
  local new_version=$1
  node -e "
    const fs = require('fs');
    const pkg = require('$PACKAGE_JSON');
    pkg.version = '$new_version';
    fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
  "
}

# Update version in app.json
update_app_version() {
  local new_version=$1
  node -e "
    const fs = require('fs');
    const app = require('$APP_JSON');
    app.expo.version = '$new_version';
    fs.writeFileSync('$APP_JSON', JSON.stringify(app, null, 2) + '\n');
  "
}

# Update versionCode in app.json
update_version_code() {
  local new_version_code=$1
  node -e "
    const fs = require('fs');
    const app = require('$APP_JSON');
    app.expo.android.versionCode = $new_version_code;
    fs.writeFileSync('$APP_JSON', JSON.stringify(app, null, 2) + '\n');
  "
}

# Main script
if [ $# -eq 0 ]; then
  echo "Usage: $0 [major|minor|patch|version]"
  echo "Example: $0 patch"
  echo "Example: $0 1.0.15"
  exit 1
fi

cd "$PROJECT_ROOT"

current_version=$(get_current_version)
current_version_code=$(get_current_version_code)

if [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Direct version provided
  new_version=$1
else
  # Increment version
  new_version=$(increment_version "$current_version" "$1")
fi

# Increment versionCode
new_version_code=$((current_version_code + 1))

echo "Current version: $current_version"
echo "Current versionCode: $current_version_code"
echo "New version: $new_version"
echo "New versionCode: $new_version_code"
echo ""

# Update files
update_package_version "$new_version"
update_app_version "$new_version"
update_version_code "$new_version_code"

echo "✓ Updated package.json version to $new_version"
echo "✓ Updated app.json version to $new_version"
echo "✓ Updated app.json versionCode to $new_version_code"


