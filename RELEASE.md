# Release Instructions

**⚠️ MUST READ BEFORE CREATING A RELEASE**

This document provides step-by-step instructions for creating a new release of ProAssist. Follow these steps carefully to ensure proper builds, signing, and auto-update functionality.

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All changes are committed and pushed to `main` branch
- [ ] Version number updated in `src-tauri/tauri.conf.json`
- [ ] `CHANGELOG.md` updated with new features/fixes (if maintained)
- [ ] All tests pass (if applicable)
- [ ] GitHub Secrets are configured:
  - [ ] `TAURI_SIGNING_PRIVATE_KEY` is set
  - [ ] `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is set (or empty if no password)

## Step-by-Step Release Process

### 1. Update Version Number

Update the version in `src-tauri/tauri.conf.json`:

```json
{
  "version": "0.2.0" // Increment from previous version
}
```

**Version Format**: Use [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.2.0): New features, backward compatible
- **PATCH** (0.1.1): Bug fixes

### 2. Commit Version Change

```bash
git add src-tauri/tauri.conf.json
git commit -m "Bump version to 0.2.0"
git push origin main
```

### 3. Create and Push Git Tag

Create a tag matching your version (must start with `v`):

```bash
# Create the tag
git tag v0.2.0

# Push the tag to trigger GitHub Actions
git push origin v0.2.0
```

**Important**: The tag name must match the version in `tauri.conf.json` with a `v` prefix.

### 4. Monitor GitHub Actions

1. Go to your repository → **Actions** tab
2. Watch the **Release** workflow run
3. The workflow will:
   - Create a draft GitHub Release
   - Build for all platforms (Windows, macOS Intel, macOS Apple Silicon, Linux)
   - Sign all update bundles
   - Upload installers and `latest.json` to the release
   - Publish the release automatically

### 5. Verify Release

After the workflow completes:

1. Go to **Releases** page
2. Verify the release is published (not draft)
3. Check that all platform installers are present:
   - Windows: `.msi` and `.exe`
   - macOS: `.dmg` (both architectures)
   - Linux: `.AppImage` and `.deb`
4. Verify `latest.json` is present in the release assets

### 6. Test Auto-Update (Recommended)

1. Install an older version of the app
2. Launch the app
3. Verify it detects the new update
4. Test the update installation process

## Alternative: Manual Workflow Dispatch

If you need to trigger a build without creating a tag:

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Select branch (usually `main`)
4. Click **Run workflow**

**Note**: This still requires a version tag to be created for the release to be properly versioned.

## Troubleshooting

### Build Fails

- **Check GitHub Secrets**: Ensure `TAURI_SIGNING_PRIVATE_KEY` is correctly set
- **Check Logs**: Review the failed job's logs in Actions
- **Verify Dependencies**: Ensure all dependencies are up to date

### Update Not Detected

- **Version Check**: Ensure new version is higher than installed version
- **Public Key**: Verify `tauri.conf.json` has the correct public key
- **Release Assets**: Check that `latest.json` exists in release assets
- **URL**: Verify the endpoint URL in `tauri.conf.json` matches your repository

### Signature Verification Failed

- **Key Mismatch**: Public key in config must match private key in secrets
- **Key Format**: Ensure keys are copied completely (no truncation)
- **Password**: If you set a password, ensure `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is set

### Missing Platform Builds

- **Check Matrix**: Verify all platforms in workflow matrix are building
- **Review Logs**: Check individual platform build logs
- **Dependencies**: Some platforms may need additional system dependencies

## Release Notes Template

When creating a release, consider including:

```markdown
## What's New in v0.2.0

### ✨ New Features

- Feature 1 description
- Feature 2 description

### 🐛 Bug Fixes

- Fixed issue with...
- Resolved problem with...

### 🔧 Improvements

- Enhanced performance of...
- Improved UI for...

### 📝 Documentation

- Updated setup instructions
- Added new examples

---

**Download**: [Get the latest version](https://github.com/crownemmanuel/proassist/releases/latest)
```

## Version History

Keep track of releases:

- `v0.1.0` - Initial release with auto-update support
- `v0.2.0` - [Your release notes here]

## Important Notes

- **Never delete releases**: Deleting a release breaks auto-update for users who installed that version
- **Keep private key secure**: If compromised, you'll need to generate new keys and users will need to reinstall
- **Test before release**: Always test the build process on a test tag first if possible
- **Semantic versioning**: Follow semver to help users understand the impact of updates

## Quick Reference

```bash
# Full release workflow
git add src-tauri/tauri.conf.json
git commit -m "Bump version to X.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z

# Then monitor Actions → Release workflow
```

---

**For LLMs/Developers**: Always check this file before creating releases. The process is automated via GitHub Actions, but version numbers and tags must be set correctly.
