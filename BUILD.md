# Building and Releasing Tracker Core

## Overview

Tracker Core is a shared Node.js library package installed directly from GitHub. Consumers install it using:

```json
{
  "dependencies": {
    "@owlcms/tracker-core": "github:owlcms/tracker-core"
  }
}
```

## Release Process

### Automated Release Script

The `release` script automates version bumping, git tagging, and pushing:

```bash
npm run release <version>
```

**Examples:**

```bash
# Standard release
npm run release 1.0.0

# Pre-release
npm run release 1.0.0-beta02

# With build metadata
npm run release 1.0.0+20250102
```

**What the script does:**

1. **Validates version** - Checks semver format
2. **Updates package.json** - Bumps version number
3. **Commits change** - `git commit -m "chore: release X.Y.Z"`
4. **Creates tag** - `git tag X.Y.Z` (no "v" prefix)
5. **Pushes to GitHub** - Pushes both commit and tag

### Manual Release Steps (if needed)

```bash
# 1. Update version in package.json
npm version 1.0.0 --no-git-tag-version

# 2. Commit
git add package.json
git commit -m "chore: release 1.0.0"

# 3. Tag (no "v" prefix)
git tag 1.0.0

# 4. Push
git push
git push origin 1.0.0
```

## Version Format

**Valid semver formats:**
- `X.Y.Z` - Standard release (e.g., `1.0.0`)
- `X.Y.Z-suffix` - Pre-release (e.g., `1.0.0-beta02`, `1.0.0-rc1`)
- `X.Y.Z+metadata` - Build metadata (e.g., `1.0.0+20250102`)
- `X.Y.Z-suffix+metadata` - Combined (e.g., `1.0.0-beta02+build123`)

**Important:** Do NOT use "v" prefix (e.g., use `1.0.0`, not `v1.0.0`)

## How Consumers Get Updates

### Automatic Updates (Latest)

When consumers have this in package.json:

```json
{
  "dependencies": {
    "@owlcms/tracker-core": "github:owlcms/tracker-core"
  }
}
```

They get updates by running:

```bash
npm update @owlcms/tracker-core
```

This fetches the latest commit from the `main` branch.

### Pinned Version (Recommended for Production)

Consumers can pin to a specific tag:

```json
{
  "dependencies": {
    "@owlcms/tracker-core": "github:owlcms/tracker-core#1.0.0"
  }
}
```

Or specific commit hash:

```json
{
  "dependencies": {
    "@owlcms/tracker-core": "github:owlcms/tracker-core#abc123def456"
  }
}
```

### Version Resolution in package-lock.json

When consumers run `npm install` or `npm update`, npm writes the exact commit hash to `package-lock.json`:

```json
{
  "packages": {
    "node_modules/@owlcms/tracker-core": {
      "resolved": "git+ssh://git@github.com/owlcms/tracker-core.git#abc123def456"
    }
  }
}
```

This ensures reproducible builds - `npm ci` installs the exact same version.

## Development Workflow

### Local Development with Linked Package

When developing tracker-core alongside a consumer project (like owlcms-tracker):

```bash
# 1. Link tracker-core globally (from tracker-core directory)
cd tracker-core
npm link

# 2. Link in consumer project
cd ../owlcms-tracker
npm link @owlcms/tracker-core

# 3. Make changes to tracker-core
# Changes are immediately reflected in the consumer

# 4. Test changes
cd ../owlcms-tracker
npm run dev
```

### Checking Link Status

```bash
# In consumer project directory
npm ls --link

# Check if tracker-core is a symlink
ls -l node_modules/@owlcms/tracker-core
```

## Testing Changes Before Release

### Using npm link (Recommended)

Best for rapid iteration:

```bash
# 1. Make changes to tracker-core
cd tracker-core
# ... edit files ...

# 2. Test immediately in consumer
cd ../owlcms-tracker
npm run dev
# Changes are live!
```

### Using GitHub Branch

For testing before merging to main:

```bash
# 1. Create feature branch in tracker-core
cd tracker-core
git checkout -b feature/my-change
git push origin feature/my-change

# 2. Install from branch in consumer
cd ../owlcms-tracker
npm install github:owlcms/tracker-core#feature/my-change

# 3. Test
npm run dev

# 4. When satisfied, merge to main and release
cd ../tracker-core
git checkout main
git merge feature/my-change
npm run release 1.0.1
```

## Coordinated Release with owlcms-tracker

When releasing both packages together:

```bash
# 1. Release tracker-core first
cd tracker-core
npm run release 1.0.0-beta02

# 2. Update owlcms-tracker to use new version
cd ../owlcms-tracker
npm update @owlcms/tracker-core

# 3. Verify the commit hash
grep "resolved.*tracker-core" package-lock.json

# 4. Release owlcms-tracker
npm run release -- 2.4.0
```

The owlcms-tracker release script can also specify a tracker-core version:

```bash
# Release owlcms-tracker pinned to specific tracker-core version
npm run release -- 2.4.0 1.0.0-beta02
```

## Troubleshooting

### Changes not reflected in consumer

**Problem:** Made changes to tracker-core but consumer doesn't see them

**Solution:** Ensure npm link is active

```bash
# Check link status
cd owlcms-tracker
npm ls --link

# If not linked, re-link
cd ../tracker-core
npm link
cd ../owlcms-tracker
npm link @owlcms/tracker-core
```

### Consumer stuck on old version

**Problem:** `npm update @owlcms/tracker-core` doesn't fetch latest

**Solution:** Clear cache and reinstall

```bash
npm cache clean --force
rm -rf node_modules/@owlcms/tracker-core
npm install
```

### Release tag already exists

**Problem:** `git tag 1.0.0` fails because tag exists

**Solution:** Delete tag and re-create

```bash
# Delete local tag
git tag -d 1.0.0

# Delete remote tag
git push origin :refs/tags/1.0.0

# Re-run release script
npm run release 1.0.0
```

## Development Tips

### Verify Exports

Check that all required exports are available:

```bash
node scripts/verify-exports.js
```

This validates that consumers can access all expected functions and modules.

### Test with Unlinked Install

Before releasing, test that the package installs correctly from GitHub:

```bash
# Unlink
cd owlcms-tracker
npm unlink --no-save @owlcms/tracker-core

# Install from GitHub
npm install

# Test
npm run dev

# Re-link for continued development
npm link @owlcms/tracker-core
```

### Directory Structure Assumption

Release scripts assume this directory layout:

```
Dev/
├── git/
│   ├── owlcms-tracker/
│   └── tracker-core/
```

Adjust paths if your directories are organized differently.

## Best Practices

### Semantic Versioning

Follow semver conventions:

- **Patch** (1.0.1): Bug fixes, no API changes
- **Minor** (1.1.0): New features, backward compatible
- **Major** (2.0.0): Breaking changes

Pre-release tags:
- `1.0.0-alpha01` - Very early, unstable
- `1.0.0-beta01` - Feature complete, testing
- `1.0.0-rc1` - Release candidate, final testing

### Testing Before Release

1. Run verify-exports script
2. Test with linked consumer
3. Test with unlinked consumer (GitHub install)
4. Run consumer's test suite
5. Tag and release

### Breaking Changes

When making breaking changes:

1. Document in CHANGELOG
2. Bump major version (e.g., 1.x.x → 2.0.0)
3. Update consumer code before releasing
4. Coordinate release timing with consumers
