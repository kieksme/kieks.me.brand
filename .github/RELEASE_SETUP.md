# Release Setup Instructions

## Initial Release Setup

**Important:** release-please requires an existing release to work properly. You need to create an initial release manually before the automated workflow can function.

### Step 1: Create and push the initial tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

### Step 2: Create the initial release on GitHub

1. Go to the repository on GitHub
2. Navigate to "Releases" → "Draft a new release"
3. Select tag `v0.1.0`
4. Add release title: "v0.1.0 - Initial Release"
5. Add release notes (you can use the content from RELEASE_README.md template)
6. Click "Publish release"

### Step 3: Verify the release

After publishing, verify that:

- The release appears in the Releases section
- The tag `v0.1.0` is visible
- The `.release-please-manifest.json` file contains `".": "0.1.0"`

## Future Releases

Once the initial release is set up, release-please will:

- Automatically create release PRs when you push to `main` (if there are changes)
- You can merge the release PR to create a new release
- The `release.yml` workflow will automatically package and upload all assets

## Commit Message Format

The `simple` release-type is flexible and works with any commit messages. However, for better release notes and automatic version bumping, consider using Conventional Commits format:

- `feat: Add new logo variant` - Creates a minor version bump
- `feat(docs): Update guidelines` - Creates a minor version bump (use `feat(docs):` instead of `docs:` to trigger a release)
- `fix: Update color palette` - Creates a patch version bump
- `docs: Update guidelines` - No version bump (documentation only, ignored by release-please)
- `feat!: Breaking change` - Creates a major version bump

**Important:** The `simple` release-type only recognizes `feat:`, `fix:`, and `deps:` commits as releasable units. To trigger a minor release for documentation changes, use `feat(docs):` instead of `docs:`.

### Forcing a Release for Existing `docs:` Commits

If you have already made `docs:` commits and want to trigger a release, you can create an empty commit with `Release-As:`:

```bash
git commit --allow-empty -m "chore: release 0.2.0" -m "Release-As: 0.2.0"
git push origin main
```

This will create a release PR for the specified version.

## Troubleshooting

If release-please fails with commit parsing errors:

- This is normal for the initial setup before the first release exists
- Create the initial release manually as described above
- Future releases will work automatically

If you see JSON parsing errors:

- Ensure `.release-please-manifest.json` is valid JSON
- The file should contain: `{ ".": "0.1.0" }`
- No trailing commas or extra characters

### Private Repository Setup

For private repositories, you need to use a Personal Access Token (PAT) instead of the default `GITHUB_TOKEN`:

1. **Create a Personal Access Token:**
   - Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Give it a name (e.g., "Release Please Token")
   - Select scopes: `repo` (full control of private repositories)
   - Generate and copy the token

2. **Add the token as a repository secret:**
   - Go to your repository settings
   - Navigate to "Secrets and variables" > "Actions"
   - Click "New repository secret"
   - Name: `RELEASE_PLEASE_TOKEN`
   - Value: Paste your PAT
   - Click "Add secret"

3. **Update the workflow** to use the PAT:
   ```yaml
   - uses: googleapis/release-please-action@v4
     with:
       config-file: release-please-config.json
       token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
   ```
