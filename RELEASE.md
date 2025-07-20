# Canvas Browser Extension Release Guide

This document explains how to create and manage releases for Canvas Browser Extension.

## Release Strategy

We use **GitHub Actions** for automated builds and releases, triggered by Git tags. This ensures consistent, reproducible builds across all supported browsers.

### Release Types

- **Stable releases**: `v2.0.0`, `v2.1.3` - Full releases
- **Pre-releases**: `v2.0.0-alpha.1`, `v2.1.0-beta.2` - Automatically marked as pre-release
- **Development builds**: Built on every push to `main`/`develop` (available as artifacts)

## Creating a Release

### 1. Prepare for Release

```bash
# Ensure you're on main branch and up to date
git checkout main
git pull origin main

# Navigate to browser extension directory
cd src/ui/browser-extension

# Run tests and build locally
npm run build:dev
# Test both packages
unzip -t packages/canvas-extension-chromium.zip
unzip -t packages/canvas-extension-firefox.zip

# Update version in package.json if needed
npm version patch  # or minor, major
```

### 2. Create and Push Tag

```bash
# Create a new tag (this triggers the release workflow)
git tag v2.0.0

# Push the tag to GitHub
git push origin v2.0.0
```

### 3. Automated Release Process

Once you push a tag, GitHub Actions will automatically:

1. ✅ **Extract version** from the tag
2. ✅ **Update version** in package.json and manifest files
3. ✅ **Build packages** for both browsers:
   - Chromium-based browsers (Chrome, Edge, Brave, Opera)
   - Firefox
4. ✅ **Test packages** to ensure they work and are valid
5. ✅ **Create ZIP archives** with proper naming
6. ✅ **Generate checksums** for verification
7. ✅ **Create GitHub Release** with:
   - Professional release notes
   - Download links for both browser packages
   - Installation instructions
   - Checksum verification guide

### 4. Post-Release

After the automated release:

1. **Verify the release** on GitHub
2. **Test installations** on different browsers
3. **Update documentation** if needed
4. **Submit to browser stores** (when available):
   - Chrome Web Store
   - Firefox Add-ons (AMO)
   - Edge Add-ons

## Browser Store Submission

### Chrome Web Store
- Package: Use the Chromium ZIP from GitHub releases
- Developer Dashboard: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Review time: Typically 1-3 business days

### Firefox Add-ons (AMO)
- Package: Use the Firefox ZIP from GitHub releases
- Developer Hub: [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
- Review time: Typically 1-7 days depending on complexity

### Edge Add-ons
- Package: Use the Chromium ZIP (compatible with Edge)
- Partner Center: [Microsoft Edge Add-ons Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)
- Review time: Typically 1-7 business days

## Manual Release (Emergency/Testing)

If you need to create a release manually:

```bash
cd src/ui/browser-extension

# Install dependencies
npm ci

# Build production packages
npm run build

# Verify packages exist
ls -la packages/

# Create release directory
mkdir -p release-assets

# Copy packages with versioned names
cp packages/canvas-extension-chromium.zip release-assets/canvas-extension-2.0.0-chromium.zip
cp packages/canvas-extension-firefox.zip release-assets/canvas-extension-2.0.0-firefox.zip

# Generate checksums
cd release-assets
sha256sum *.zip > checksums.txt

# Upload to GitHub manually via web interface
```

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `v2.1.3`)
- **MAJOR**: Breaking changes or major feature additions
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Pre-release Versions

- **Alpha**: `v2.0.0-alpha.1` - Early testing, unstable
- **Beta**: `v2.0.0-beta.1` - Feature complete, testing for bugs
- **RC**: `v2.0.0-rc.1` - Release candidate, final testing

## Release Checklist

Before creating a release:

- [ ] All tests pass locally
- [ ] Version numbers updated in package.json and manifests
- [ ] DEVELOPMENT.md updated (if maintained)
- [ ] No critical issues in GitHub Issues
- [ ] Extension works on all supported browsers
- [ ] Canvas server compatibility verified
- [ ] Main branch is stable

After release:

- [ ] GitHub release created successfully
- [ ] Both browser packages download and install correctly
- [ ] Extension functions properly in both browsers
- [ ] Checksums verify correctly
- [ ] Release notes are accurate and helpful
- [ ] Store submissions prepared (if applicable)

## Hotfix Releases

For critical bug fixes:

1. Create a hotfix branch from the release tag
2. Apply the minimal fix
3. Test thoroughly on both browsers
4. Create a new patch version tag
5. The automation will handle the rest

```bash
git checkout v2.0.0
git checkout -b hotfix/v2.0.1
# Make fixes
git commit -m "Fix critical extension bug"
git tag v2.0.1
git push origin v2.0.1
```

## Rollback Strategy

If a release has critical issues:

1. **Immediate**: Mark the GitHub release as "Pre-release" to reduce visibility
2. **Short-term**: Create a new hotfix release
3. **Browser stores**: Update store listings if the extension was already submitted
4. **Long-term**: Delete the problematic release if necessary

```bash
# Delete a tag locally and remotely (use carefully!)
git tag -d v2.0.0
git push origin :refs/tags/v2.0.0
```

## Monitoring Releases

- **GitHub Actions**: Monitor build status at `/actions`
- **Downloads**: Track download stats on the releases page
- **Issues**: Watch for reports of broken packages or installation problems
- **Browser compatibility**: Monitor for browser update compatibility issues
- **Store reviews**: Monitor browser store reviews and ratings

## Security Considerations

- **Package integrity**: Always verify with provided SHA256 hashes
- **Manifest validation**: Automated validation of manifest files during build
- **Supply chain**: All builds happen in clean GitHub Actions environments
- **Provenance**: Full build logs available in GitHub Actions
- **Store security**: Browser stores provide additional security review

## Future Enhancements

Planned improvements to the release process:

- [ ] **Automated store submissions** for Chrome Web Store and Firefox AMO
- [ ] **Auto-update mechanism** for sideloaded extensions
- [ ] **Beta channel** for pre-release testing
- [ ] **Automated changelog generation** from commit messages
- [ ] **Extension performance monitoring** and metrics
- [ ] **Automated browser compatibility testing** 
